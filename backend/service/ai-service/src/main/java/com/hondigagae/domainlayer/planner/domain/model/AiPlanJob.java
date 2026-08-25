package com.hondigagae.domainlayer.planner.domain.model;

import com.hondigagae.domainlayer.planner.application.info.AiPlanDraftInfo;
import java.time.Instant;
import java.util.Map;
import lombok.Builder;

@Builder
public record AiPlanJob(
    String jobId,
    Long memberId,
    String requestHash,
    Map<String, String> requestParams,
    AiPlanJobStatus status,
    String errorCode,
    String errorMessage,
    Instant createdAt,
    Instant startedAt,
    Instant completedAt,
    AiPlanDraftInfo planDraft
) {

    public AiPlanJob withStatus(AiPlanJobStatus next, Instant now) {
        return toBuilder()
            .status(next)
            .startedAt(next == AiPlanJobStatus.RUNNING ? now : startedAt)
            .completedAt(next.isTerminal() ? now : completedAt)
            .build();
    }

    public AiPlanJob completedWithDraft(AiPlanDraftInfo draft, Instant now) {
        return toBuilder()
            .status(AiPlanJobStatus.COMPLETED)
            .errorCode(null)
            .errorMessage(null)
            .completedAt(now)
            .planDraft(draft)
            .build();
    }

    public AiPlanJob failed(String errorCode, String errorMessage, Instant now) {
        return toBuilder()
            .status(AiPlanJobStatus.FAILED)
            .errorCode(errorCode)
            .errorMessage(errorMessage)
            .completedAt(now)
            .build();
    }

    // 상태 전이 시 전체 필드를 수동 재빌드하다 새 필드를 누락하는 실수를 막기 위해
    // 현재 값을 모두 복사한 빌더에서 시작한다.
    private AiPlanJobBuilder toBuilder() {
        return AiPlanJob.builder()
            .jobId(jobId)
            .memberId(memberId)
            .requestHash(requestHash)
            .requestParams(requestParams)
            .status(status)
            .errorCode(errorCode)
            .errorMessage(errorMessage)
            .createdAt(createdAt)
            .startedAt(startedAt)
            .completedAt(completedAt)
            .planDraft(planDraft);
    }
}
