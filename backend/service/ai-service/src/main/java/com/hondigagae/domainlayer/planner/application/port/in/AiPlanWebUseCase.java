package com.hondigagae.domainlayer.planner.application.port.in;

import com.hondigagae.domainlayer.planner.adapter.in.web.dto.response.AiPlanJobStatusResponse;
import com.hondigagae.domainlayer.planner.application.info.AiPlanJobInfo;
import com.hondigagae.domainlayer.planner.application.model.AiPlanJobSubscription;
import java.util.function.Consumer;
import com.hondigagae.domainlayer.planner.adapter.in.web.dto.response.AiPlanSubmitResponse;
import com.hondigagae.domainlayer.planner.application.command.AiPlanCreateCommand;

public interface AiPlanWebUseCase {

    AiPlanSubmitResponse submitPlan(long memberId, AiPlanCreateCommand command);

    AiPlanJobStatusResponse getJobStatus(String jobId, long memberId);

    /** SSE 스트리머용 상태 스냅샷. 소유권 검증과 멈춘 잡 만료 처리는 getJobStatus 와 같은 경로를 탄다. */
    AiPlanJobInfo getJobInfo(String jobId, long memberId);

    /**
     * 잡 상태 변경 구독. 이벤트 수신 시마다 저장소에서 최신 상태를 다시 읽어 전달하므로
     * pub/sub 메시지 자체에는 상태를 싣지 않는다(발행-저장 순서 역전, 스키마 드리프트 방지).
     */
    AiPlanJobSubscription subscribeJobUpdates(String jobId, long memberId, Consumer<AiPlanJobInfo> onUpdate);
}
