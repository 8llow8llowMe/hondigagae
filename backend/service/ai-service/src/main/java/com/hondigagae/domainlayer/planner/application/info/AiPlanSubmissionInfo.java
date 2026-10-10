package com.hondigagae.domainlayer.planner.application.info;

import com.hondigagae.domainlayer.planner.domain.model.AiPlanSubmissionStatus;
import lombok.Builder;

@Builder
public record AiPlanSubmissionInfo(
    AiPlanSubmissionStatus submissionStatus,
    String jobId
) {

    public static AiPlanSubmissionInfo accepted(String jobId) {
        return AiPlanSubmissionInfo.builder()
            .submissionStatus(AiPlanSubmissionStatus.ACCEPTED)
            .jobId(jobId)
            .build();
    }
}
