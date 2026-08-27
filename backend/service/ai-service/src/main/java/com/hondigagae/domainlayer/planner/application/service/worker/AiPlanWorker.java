package com.hondigagae.domainlayer.planner.application.service.worker;

import com.hondigagae.domainlayer.planner.application.exception.AiPlanErrorCode;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanException;
import com.hondigagae.domainlayer.planner.application.info.AiPlanDraftInfo;
import com.hondigagae.domainlayer.planner.application.model.AiPlanGenerationQuery;
import com.hondigagae.domainlayer.planner.application.model.PlaceCandidate;
import com.hondigagae.domainlayer.planner.application.port.out.AiLlmPort;
import com.hondigagae.domainlayer.planner.application.port.out.AiPlanJobStorePort;
import com.hondigagae.domainlayer.planner.application.port.out.PlaceCandidateQueryPort;
import com.hondigagae.domainlayer.planner.application.port.out.query.PlaceCandidateQueryResult;
import com.hondigagae.global.properties.AiLlmProperties;
import java.util.List;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJob;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJobStatus;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class AiPlanWorker {

    private final AiPlanJobStorePort aiPlanJobStorePort;
    private final AiLlmPort aiLlmPort;
    private final PlaceCandidateQueryPort placeCandidateQueryPort;
    private final AiLlmProperties aiLlmProperties;

    @Async("aiPlanTaskExecutor")
    public void runJob(String jobId) {
        AiPlanJob running;
        try {
            Optional<AiPlanJob> jobHolder = aiPlanJobStorePort.findById(jobId);
            if (jobHolder.isEmpty()) {
                log.warn("AI plan job missing on worker pickup jobId={}", jobId);
                return;
            }
            AiPlanJob job = jobHolder.get();
            if (job.status() != AiPlanJobStatus.PENDING) {
                log.info("AI plan job already advanced before worker pickup jobId={} status={}", jobId, job.status());
                return;
            }
            running = aiPlanJobStorePort.save(job.withStatus(AiPlanJobStatus.RUNNING, Instant.now()));
        } catch (RuntimeException pickupFailure) {
            log.error("AI plan job pickup failed jobId={} reason={}", jobId, pickupFailure.getMessage(), pickupFailure);
            return;
        }

        try {
            // LLM 포트는 domain model을 준다. 저장·응답에 쓰는 Info 변환은 이 계층에서 수행한다.
            AiPlanDraft draft = aiLlmPort.generatePlanDraft(toQuery(running.requestParams()));
            log.info("AI plan draft generated jobId={} days={}", running.jobId(),
                draft.days() == null ? 0 : draft.days().size());
            aiPlanJobStorePort.save(running.completedWithDraft(AiPlanDraftInfo.from(draft), Instant.now()));
        } catch (AiPlanException domainException) {
            log.error("AI plan job failed jobId={} memberId={} errorCode={} cause={}",
                running.jobId(), running.memberId(),
                domainException.getErrorCode().getCode(), domainException.getMessage(), domainException);
            aiPlanJobStorePort.save(running.failed(
                domainException.getErrorCode().getCode(), domainException.getErrorCode().getMessage(), Instant.now()
            ));
        } catch (Exception unexpected) {
            log.error("AI plan job failed unexpectedly jobId={} memberId={} type={} cause={}",
                running.jobId(), running.memberId(),
                unexpected.getClass().getSimpleName(), unexpected.getMessage(), unexpected);
            aiPlanJobStorePort.save(running.failed(
                AiPlanErrorCode.JOB_FAILED.getCode(), AiPlanErrorCode.JOB_FAILED.getMessage(), Instant.now()
            ));
        } finally {
            aiPlanJobStorePort.releaseIdempotencyKey(running.memberId(), running.requestHash());
        }
    }

    /**
     * 저장된 요청 파라미터를 LLM 질의로 옮기면서 <b>후보 장소를 여기서 붙인다.</b>
     *
     * <p>후보 조회를 어댑터가 아니라 이 계층이 하는 이유는, 어떤 데이터를 근거로 쓸지가
     * provider 세부사항이 아니라 <b>유스케이스의 결정</b>이기 때문이다. provider 를 바꿔도
     * "실제 DB 에 있는 동반 가능 장소 안에서만 고른다"는 규칙은 그대로 남아야 한다.
     */
    private AiPlanGenerationQuery toQuery(Map<String, String> params) {
        String areaCode = params.get("areaCode");
        return AiPlanGenerationQuery.builder()
            .areaCode(areaCode)
            .startDate(params.get("startDate"))
            .endDate(params.get("endDate"))
            .budget(params.get("budget"))
            .petId(params.get("petId"))
            .requestNote(params.get("requestNote"))
            .placeCandidates(loadCandidates(areaCode))
            .build();
    }

    /**
     * 후보 장소를 가져온다. <b>필요하다고 선언한 구현일 때만</b> 부른다.
     *
     * <p>스텁은 후보를 쓰지 않으므로 부르지 않는다. 무조건 불러 두면 키 없이 띄운 로컬에서
     * tour-service 까지 함께 떠 있어야 일정 생성이 도는 셈이 되어, 스텁을 남겨 둔 이유가 사라진다.
     */
    private List<PlaceCandidate> loadCandidates(String areaCode) {
        if (!aiLlmPort.requiresPlaceCandidates()) {
            return List.of();
        }
        return placeCandidateQueryPort
            .findPetFriendlyCandidates(areaCode, aiLlmProperties.placeCandidateSize()).stream()
            .map(this::toCandidate)
            .toList();
    }

    private PlaceCandidate toCandidate(PlaceCandidateQueryResult result) {
        return PlaceCandidate.builder()
            .placeId(result.placeId())
            .title(result.title())
            .contentTypeName(result.contentTypeName())
            .addr(result.addr())
            .petAllowanceName(result.petAllowanceName())
            .indoor(result.indoor())
            .sourceCategory(result.sourceCategory())
            .lat(result.lat())
            .lng(result.lng())
            .build();
    }
}
