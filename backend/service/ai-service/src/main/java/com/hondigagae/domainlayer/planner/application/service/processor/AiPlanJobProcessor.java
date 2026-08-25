package com.hondigagae.domainlayer.planner.application.service.processor;

import com.hondigagae.domainlayer.planner.application.command.AiPlanCreateCommand;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanErrorCode;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanException;
import com.hondigagae.domainlayer.planner.application.info.AiPlanJobInfo;
import com.hondigagae.domainlayer.planner.application.info.AiPlanSubmissionInfo;
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

    private static final String JOB_TYPE = "AI_PLAN";

    private final AiPlanJobStorePort aiPlanJobStorePort;
    private final AiPlanWorker aiPlanWorker;
    private final AiPlanJobProperties aiPlanJobProperties;

    public AiPlanSubmissionInfo submitPlan(long memberId, AiPlanCreateCommand command) {
        if (command.startDate().isAfter(command.endDate())) {
            throw new AiPlanException(AiPlanErrorCode.DATE_RANGE_INVALID);
        }

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
            aiPlanJobStorePort.releaseIdempotencyKey(memberId, requestHash);
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

        AiPlanJob effectiveJob = expireIfStuck(job);

        return AiPlanJobInfo.builder()
            .jobId(effectiveJob.jobId())
            .status(effectiveJob.status())
            .planDraft(effectiveJob.status() == AiPlanJobStatus.COMPLETED ? effectiveJob.planDraft() : null)
            .errorCode(effectiveJob.errorCode())
            .errorMessage(effectiveJob.errorMessage())
            .build();
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
        AiPlanJob expired = job.failed(
            AiPlanErrorCode.JOB_TIMEOUT.getCode(), AiPlanErrorCode.JOB_TIMEOUT.getMessage(), now
        );
        aiPlanJobStorePort.save(expired);
        aiPlanJobStorePort.releaseIdempotencyKey(job.memberId(), job.requestHash());
        return expired;
    }

    private Map<String, String> toParams(AiPlanCreateCommand command) {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("areaCode", command.areaCode());
        params.put("startDate", command.startDate().toString());
        params.put("endDate", command.endDate().toString());
        params.put("budget", command.budget() == null ? "" : String.valueOf(command.budget()));
        params.put("petId", String.valueOf(command.petId()));
        params.put("requestNote", command.requestNote() == null ? "" : command.requestNote());
        return params;
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
