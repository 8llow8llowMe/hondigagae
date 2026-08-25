package com.hondigagae.domainlayer.planner.application.service.worker;

import com.hondigagae.domainlayer.planner.application.exception.AiPlanErrorCode;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanException;
import com.hondigagae.domainlayer.planner.application.info.AiPlanDraftInfo;
import com.hondigagae.domainlayer.planner.application.model.AiPlanGenerationQuery;
import com.hondigagae.domainlayer.planner.application.port.out.AiLlmPort;
import com.hondigagae.domainlayer.planner.application.port.out.AiPlanJobStorePort;
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

    private AiPlanGenerationQuery toQuery(Map<String, String> params) {
        return AiPlanGenerationQuery.builder()
            .areaCode(params.get("areaCode"))
            .startDate(params.get("startDate"))
            .endDate(params.get("endDate"))
            .budget(params.get("budget"))
            .petId(params.get("petId"))
            .requestNote(params.get("requestNote"))
            .build();
    }
}
