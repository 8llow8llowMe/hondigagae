package com.hondigagae.domainlayer.planner.application.info;

import com.hondigagae.domainlayer.planner.domain.model.AiPlanJobStatus;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJobStep;
import lombok.Builder;

@Builder
public record AiPlanJobInfo(
    String jobId,
    AiPlanJobStatus status,
    // 지금 밟고 있는 세부 단계. 아직 시작하지 않았으면 null 이다.
    AiPlanJobStep step,
    AiPlanDraftInfo planDraft,
    String errorCode,
    String errorMessage
) {

}
