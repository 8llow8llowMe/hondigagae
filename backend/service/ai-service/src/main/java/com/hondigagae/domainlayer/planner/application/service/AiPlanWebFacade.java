package com.hondigagae.domainlayer.planner.application.service;

import com.hondigagae.domainlayer.planner.adapter.in.web.dto.response.AiPlanJobStatusResponse;
import com.hondigagae.domainlayer.planner.adapter.in.web.dto.response.AiPlanSubmitResponse;
import com.hondigagae.domainlayer.planner.adapter.in.web.presenter.AiPlanPresenter;
import com.hondigagae.domainlayer.planner.application.command.AiPlanCreateCommand;
import com.hondigagae.domainlayer.planner.application.info.AiPlanJobInfo;
import com.hondigagae.domainlayer.planner.application.info.AiPlanSubmissionInfo;
import com.hondigagae.domainlayer.planner.application.info.AiPlanJobInfo;
import com.hondigagae.domainlayer.planner.application.model.AiPlanJobSubscription;
import com.hondigagae.domainlayer.planner.application.port.in.AiPlanWebUseCase;
import java.util.function.Consumer;
import com.hondigagae.domainlayer.planner.application.service.processor.AiPlanJobProcessor;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AiPlanWebFacade implements AiPlanWebUseCase {

    private final AiPlanJobProcessor aiPlanJobProcessor;
    private final AiPlanPresenter aiPlanPresenter;

    @Override
    public AiPlanSubmitResponse submitPlan(long memberId, AiPlanCreateCommand command) {
        AiPlanSubmissionInfo submissionInfo = aiPlanJobProcessor.submitPlan(memberId, command);
        return aiPlanPresenter.toSubmitResponse(submissionInfo);
    }

    @Override
    public AiPlanJobStatusResponse getJobStatus(String jobId, long memberId) {
        AiPlanJobInfo jobInfo = aiPlanJobProcessor.getJobInfo(jobId, memberId);
        return aiPlanPresenter.toJobStatusResponse(jobInfo);
    }

    @Override
    public AiPlanJobInfo getJobInfo(String jobId, long memberId) {
        return aiPlanJobProcessor.getJobInfo(jobId, memberId);
    }

    @Override
    public AiPlanJobSubscription subscribeJobUpdates(String jobId, long memberId, Consumer<AiPlanJobInfo> onUpdate) {
        return aiPlanJobProcessor.subscribeJobUpdates(jobId, memberId, onUpdate);
    }
}
