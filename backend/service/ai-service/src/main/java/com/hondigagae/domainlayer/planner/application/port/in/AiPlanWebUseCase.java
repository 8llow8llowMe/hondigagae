package com.hondigagae.domainlayer.planner.application.port.in;

import com.hondigagae.domainlayer.planner.adapter.in.web.dto.response.AiPlanJobStatusResponse;
import com.hondigagae.domainlayer.planner.adapter.in.web.dto.response.AiPlanSubmitResponse;
import com.hondigagae.domainlayer.planner.application.command.AiPlanCreateCommand;

public interface AiPlanWebUseCase {

    AiPlanSubmitResponse submitPlan(long memberId, AiPlanCreateCommand command);

    AiPlanJobStatusResponse getJobStatus(String jobId, long memberId);
}
