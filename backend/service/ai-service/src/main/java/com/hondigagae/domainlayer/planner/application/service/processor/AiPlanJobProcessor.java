package com.hondigagae.domainlayer.planner.application.service.processor;

import com.hondigagae.domainlayer.planner.application.command.AiPlanCreateCommand;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanErrorCode;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanException;
import com.hondigagae.domainlayer.planner.application.info.AiPlanConditionsInfo;
import com.hondigagae.domainlayer.planner.application.info.AiPlanDraftInfo;
import com.hondigagae.domainlayer.planner.application.info.AiPlanJobInfo;
import com.hondigagae.domainlayer.planner.application.info.AiPlanSubmissionInfo;
import com.hondigagae.domainlayer.planner.application.model.AiPlanJobSubscription;
import com.hondigagae.domainlayer.planner.application.port.out.AiPlanJobEventPort;
import com.hondigagae.domainlayer.planner.application.port.out.AiPlanJobStorePort;
import com.hondigagae.domainlayer.planner.application.service.worker.AiPlanWorker;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJob;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJobStatus;
import com.hondigagae.global.properties.AiPlanJobProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.function.Consumer;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.stream.Collectors;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.RejectedExecutionException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class AiPlanJobProcessor {

    /** AI 생성 여행 일수 상한. 후보 풀·프롬프트 규모와 예보 커버리지(약 11일)에 맞춘 값이다. */
    private static final int MAX_TRIP_DAYS = 10;

    private static final String JOB_TYPE = "AI_PLAN";

    private final AiPlanJobStorePort aiPlanJobStorePort;
    private final AiPlanJobEventPort aiPlanJobEventPort;
    private final AiPlanWorker aiPlanWorker;
    private final AiPlanJobProperties aiPlanJobProperties;

    public AiPlanSubmissionInfo submitPlan(long memberId, AiPlanCreateCommand command) {
        if (command.startDate().isAfter(command.endDate())) {
            throw new AiPlanException(AiPlanErrorCode.DATE_RANGE_INVALID);
        }
        // 과거 여행의 AI 생성은 의미가 없고, 날씨·혼잡도 근거도 없다. 기록용 과거 일정은 plan 직접 생성으로 한다.
        if (command.startDate().isBefore(java.time.LocalDate.now())) {
            throw new AiPlanException(AiPlanErrorCode.START_DATE_IN_PAST);
        }
        // 후보 50곳 규모에서 프롬프트가 감당할 수 있는 상한. 예보 커버리지(약 11일)와도 맞춘다.
        if (ChronoUnit.DAYS.between(command.startDate(), command.endDate()) + 1 > MAX_TRIP_DAYS) {
            throw new AiPlanException(AiPlanErrorCode.TRIP_DAYS_EXCEEDED);
        }
        validateRegenerateRequest(command);

        Map<String, String> params = toParams(command);
        String requestHash = computeRequestHash(params);
        String newJobId = UUID.randomUUID().toString();

        AiPlanJob pendingJob = AiPlanJob.builder()
            .jobId(newJobId)
            .memberId(memberId)
            .requestHash(requestHash)
            .requestParams(params)
            .status(AiPlanJobStatus.PENDING)
            .createdAt(Instant.now())
            .build();

        // 먼저 저장해서, 발행된 멱등 키가 항상 존재하는 잡을 가리키게 한다.
        aiPlanJobStorePort.save(pendingJob);

        Optional<String> existingJobId = aiPlanJobStorePort.reserveOrGetExistingJobId(memberId, requestHash, newJobId);
        if (existingJobId.isPresent()) {
            // 동시 요청이 먼저 슬롯을 선점했으므로 방금 만든 잡은 회수한다.
            aiPlanJobStorePort.deleteJob(newJobId);
            return AiPlanSubmissionInfo.accepted(existingJobId.get());
        }

        try {
            aiPlanWorker.runJob(newJobId);
        } catch (RuntimeException dispatchFailure) {
            // 대기열 포화(TaskRejectedException)는 "작업 실패"가 아니라 "지금은 받을 수 없음"이다.
            AiPlanErrorCode errorCode = isQueueFull(dispatchFailure)
                ? AiPlanErrorCode.JOB_QUEUE_FULL
                : AiPlanErrorCode.JOB_FAILED;
            log.error("AI plan worker dispatch failed jobId={} memberId={} errorCode={} reason={}",
                newJobId, memberId, errorCode.getCode(), dispatchFailure.getMessage());
            aiPlanJobStorePort.save(pendingJob.failed(errorCode.getCode(), errorCode.getMessage(), Instant.now()));
            aiPlanJobStorePort.releaseIdempotencyKey(memberId, requestHash, newJobId);
            aiPlanJobEventPort.publishJobUpdated(newJobId);
        }

        return AiPlanSubmissionInfo.accepted(newJobId);
    }

    public AiPlanJobInfo getJobInfo(String jobId, long memberId) {
        AiPlanJob job = aiPlanJobStorePort.findById(jobId)
            .orElseThrow(() -> new AiPlanException(AiPlanErrorCode.JOB_NOT_FOUND));
        // 다른 사용자의 jobId는 존재 자체를 노출하지 않도록 동일하게 404로 응답한다.
        if (job.memberId() == null || !job.memberId().equals(memberId)) {
            throw new AiPlanException(AiPlanErrorCode.JOB_NOT_FOUND);
        }

        return toInfo(expireIfStuck(job));
    }

    /** 잡 하나를 응답용 Info 로. 조회와 취소가 같은 모양을 돌려주도록 한곳에 둔다. */
    private AiPlanJobInfo toInfo(AiPlanJob job) {
        return AiPlanJobInfo.builder()
            .jobId(job.jobId())
            .status(job.status())
            .step(job.step())
            // 생성 조건은 제출 때 저장한 requestParams 가 그대로 근거다 — 따로 보관하지 않는다.
            // 상태와 무관하게 채운다: 브라우저를 넘어온 화면은 초안을 담을 때 조건이 필요하고,
            // 그것만 따로 물어볼 수단이 없다 (#488).
            .conditions(AiPlanConditionsInfo.from(job.requestParams()))
            .planDraft(job.status() == AiPlanJobStatus.COMPLETED ? AiPlanDraftInfo.from(job.planDraft()) : null)
            .errorCode(job.errorCode())
            .errorMessage(job.errorMessage())
            .build();
    }

    /**
     * 사용자 취소.
     *
     * <p><b>실행 중인 스레드를 멈추지는 못한다.</b> LLM 호출은 블로킹이라 중간에 끊을 수단이
     * 없다. 여기서 하는 일은 상태를 CANCELED 로 못 박는 것이고, 워커가 단계 경계마다 그것을
     * 읽어 협조적으로 선다. 그래서 실익은 <b>가장 비싼 LLM 호출에 들어가기 전에 서는 것</b>이고,
     * 이미 들어간 뒤라면 돌아온 결과를 버리는 것까지가 전부다.
     *
     * <p>멱등 키를 함께 풀어 준다 — 취소하고 같은 조건으로 다시 넣는 것이 취소의 주된 쓰임인데,
     * 키가 남아 있으면 취소된 잡을 그대로 돌려받는다.
     *
     * <p>이미 취소된 잡을 또 취소하면 그대로 돌려준다(멱등). 완료·실패한 잡은 409 다 —
     * 취소할 것이 없다는 사실을 화면이 알아야 결과를 보여 줄 수 있다.
     */
    public AiPlanJobInfo cancelJob(String jobId, long memberId) {
        AiPlanJob job = aiPlanJobStorePort.findById(jobId)
            .orElseThrow(() -> new AiPlanException(AiPlanErrorCode.JOB_NOT_FOUND));
        if (job.memberId() == null || !job.memberId().equals(memberId)) {
            throw new AiPlanException(AiPlanErrorCode.JOB_NOT_FOUND);
        }
        if (job.status() == AiPlanJobStatus.CANCELED) {
            return toInfo(job);
        }
        if (!job.status().isCancelable()) {
            throw new AiPlanException(AiPlanErrorCode.JOB_NOT_CANCELABLE);
        }

        AiPlanJob canceled = aiPlanJobStorePort.save(job.canceled(Instant.now()));
        if (canceled.status() != AiPlanJobStatus.CANCELED) {
            // 위 isCancelable 확인과 save 사이에 워커가 종결(완료/실패)했다 — 저장소가 종결을
            // 덮지 않고 그 잡을 돌려준다. 순차 요청과 같은 계약(409)으로 알린다.
            throw new AiPlanException(AiPlanErrorCode.JOB_NOT_CANCELABLE);
        }
        aiPlanJobStorePort.releaseIdempotencyKey(job.memberId(), job.requestHash(), job.jobId());
        aiPlanJobEventPort.publishJobUpdated(jobId);
        log.info("AI plan job canceled by member jobId={} memberId={} statusBefore={} step={}",
            jobId, memberId, job.status(), job.step());
        return toInfo(canceled);
    }

    private AiPlanJob expireIfStuck(AiPlanJob job) {
        Instant now = Instant.now();
        Duration pendingLimit = Duration.ofSeconds(aiPlanJobProperties.pendingTimeoutSeconds());
        Duration runningLimit = Duration.ofSeconds(aiPlanJobProperties.runningTimeoutSeconds());

        boolean pendingExpired = job.status() == AiPlanJobStatus.PENDING
            && job.createdAt() != null
            && Duration.between(job.createdAt(), now).compareTo(pendingLimit) > 0;
        boolean runningExpired = job.status() == AiPlanJobStatus.RUNNING
            && job.startedAt() != null
            && Duration.between(job.startedAt(), now).compareTo(runningLimit) > 0;

        if (!pendingExpired && !runningExpired) {
            return job;
        }

        log.warn("AI plan job timed out jobId={} status={} createdAt={} startedAt={}",
            job.jobId(), job.status(), job.createdAt(), job.startedAt());
        AiPlanJob expired = aiPlanJobStorePort.save(job.failed(
            AiPlanErrorCode.JOB_TIMEOUT.getCode(), AiPlanErrorCode.JOB_TIMEOUT.getMessage(), now
        ));
        if (expired.status() != AiPlanJobStatus.FAILED) {
            // 판정과 save 사이에 워커가 종결(완료/취소)했다 — 그 결과가 정답이다.
            return expired;
        }
        aiPlanJobStorePort.releaseIdempotencyKey(job.memberId(), job.requestHash(), job.jobId());
        aiPlanJobEventPort.publishJobUpdated(job.jobId());
        return expired;
    }

    /**
     * 잡 상태 변경 구독. 이벤트 수신 시마다 저장소에서 최신 상태를 다시 읽어 전달하므로
     * pub/sub 메시지 자체에는 상태를 싣지 않는다(발행-저장 순서 역전, 스키마 드리프트 방지).
     */
    public AiPlanJobSubscription subscribeJobUpdates(String jobId, long memberId, Consumer<AiPlanJobInfo> onUpdate) {
        return aiPlanJobEventPort.subscribe(jobId, () -> {
            try {
                onUpdate.accept(getJobInfo(jobId, memberId));
            } catch (RuntimeException exception) {
                // 구독 콜백은 pub/sub 리스너 스레드에서 실행되므로 예외를 전파하지 않는다.
                log.warn("AI 일정 잡 이벤트 처리에 실패했습니다. jobId={} reason={}", jobId, exception.getMessage());
            }
        });
    }

    /**
     * 제출 조건을 저장용 문자열 맵으로 옮긴다.
     *
     * <p><b>여기 적는 키가 정본이다.</b> 워커({@link AiPlanWorker})가 질의를 만들 때,
     * 조회 응답({@link AiPlanConditionsInfo#from})이 조건을 되돌릴 때 같은 키를 읽는다.
     * 읽는 쪽 둘 다 키가 없으면 조용히 빈 값으로 넘어가므로 — 워커는 조건 없는 일정을 만들고
     * 조회는 조건 없는 응답을 준다 — 키 이름을 바꾼 실수는 실행해 봐야 드러난다.
     * {@code AiPlanJobConditionsRoundTripTest} 가 키 집합을 고정할 수 있도록
     * package-private static 으로 연다.
     */
    static Map<String, String> toParams(AiPlanCreateCommand command) {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("areaCode", command.areaCode());
        params.put("sigunguCode", command.sigunguCode() == null ? "" : command.sigunguCode());
        params.put("startDate", command.startDate().toString());
        params.put("endDate", command.endDate().toString());
        params.put("budget", command.budget() == null ? "" : String.valueOf(command.budget()));
        params.put("petIds", joinIds(command.petIds()));
        params.put("pinnedPlaceIds", joinIds(command.pinnedPlaceIds()));
        params.put("preferFavorites", String.valueOf(command.preferFavorites()));
        params.put("planId", command.planId() == null ? "" : String.valueOf(command.planId()));
        params.put("regenerateDay", command.regenerateDay() == null ? "" : String.valueOf(command.regenerateDay()));
        params.put("requestNote", command.requestNote() == null ? "" : command.requestNote());
        return params;
    }

    /**
     * 하루 재생성 교차 검증. 필드 단위 검증(Bean Validation)으로는 "둘이 함께"를
     * 강제할 수 없어 여기서 본다. 일차 범위는 요청의 여행 기간으로 즉시 판정한다 —
     * 비동기 워커까지 가서야 4xx 성 오류를 돌려주면 사용자가 원인을 늦게 안다.
     */
    private void validateRegenerateRequest(AiPlanCreateCommand command) {
        if (command.planId() == null && command.regenerateDay() == null) {
            return;
        }
        if (command.planId() == null || command.regenerateDay() == null) {
            throw new AiPlanException(AiPlanErrorCode.REGENERATE_REQUEST_INVALID);
        }
        long dayCount = ChronoUnit.DAYS.between(command.startDate(), command.endDate()) + 1;
        if (command.regenerateDay() > dayCount) {
            throw new AiPlanException(AiPlanErrorCode.REGENERATE_DAY_OUT_OF_RANGE);
        }
    }

    private static String joinIds(List<Long> ids) {
        return ids == null ? "" : ids.stream()
            .map(String::valueOf).collect(Collectors.joining(","));
    }

    private boolean isQueueFull(RuntimeException dispatchFailure) {
        return dispatchFailure instanceof TaskRejectedException
            || dispatchFailure.getCause() instanceof RejectedExecutionException;
    }

    private String computeRequestHash(Map<String, String> params) {
        StringBuilder builder = new StringBuilder(JOB_TYPE);
        params.forEach((k, v) -> builder.append('|').append(k).append('=').append(v));
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(builder.toString().getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest).substring(0, 32);
        } catch (NoSuchAlgorithmException exception) {
            throw new AiPlanException(AiPlanErrorCode.IDEMPOTENCY_KEY_GENERATION_FAILED, exception);
        }
    }
}
