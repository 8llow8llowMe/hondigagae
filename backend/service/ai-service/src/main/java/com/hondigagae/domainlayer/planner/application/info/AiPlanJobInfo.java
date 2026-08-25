package com.hondigagae.domainlayer.planner.application.info;

import com.hondigagae.domainlayer.planner.domain.model.AiPlanJobStatus;
import lombok.Builder;

@Builder
public record AiPlanJobInfo(
    String jobId,
    AiPlanJobStatus status,
    AiPlanDraftInfo planDraft,
    String errorCode,
    String errorMessage
) {

}
