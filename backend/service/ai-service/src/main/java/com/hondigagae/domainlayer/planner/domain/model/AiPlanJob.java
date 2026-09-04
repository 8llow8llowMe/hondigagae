package com.hondigagae.domainlayer.planner.domain.model;

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
    // 지금 밟고 있는 세부 단계. PENDING 이면 아직 없다(null).
    // 종결 상태에서는 마지막으로 밟은 단계가 남는다 - 실패 지점을 아는 것이 진단이다.
    AiPlanJobStep step,
    String errorCode,
    String errorMessage,
    Instant createdAt,
    Instant startedAt,
    Instant completedAt,
    // domain 초안을 그대로 담는다 — Info 를 여기 두면 out-port(Redis 저장)까지 application 표현이 샌다.
    AiPlanDraft planDraft
) {

    public AiPlanJob withStatus(AiPlanJobStatus next, Instant now) {
        return toBuilder()
            .status(next)
            .startedAt(next == AiPlanJobStatus.RUNNING ? now : startedAt)
            .completedAt(next.isTerminal() ? now : completedAt)
            .build();
    }

    /** 세부 단계만 옮긴다. 상태는 그대로 RUNNING 이다. */
    public AiPlanJob atStep(AiPlanJobStep next) {
        return toBuilder().step(next).build();
    }

    /**
     * 사용자 취소.
     *
     * <p>실패가 아니므로 {@code errorCode} 를 채우지 않는다. 취소를 오류로 기록하면 화면이
     * "실패했습니다" 를 띄우고, 지표에서도 장애와 섞인다.
     */
    public AiPlanJob canceled(Instant now) {
        return toBuilder()
            .status(AiPlanJobStatus.CANCELED)
            .completedAt(now)
            .build();
    }

    public AiPlanJob completedWithDraft(AiPlanDraft draft, Instant now) {
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
            .step(step)
            .errorCode(errorCode)
            .errorMessage(errorMessage)
            .createdAt(createdAt)
            .startedAt(startedAt)
            .completedAt(completedAt)
            .planDraft(planDraft);
    }
}
