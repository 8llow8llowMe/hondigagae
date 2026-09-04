package com.hondigagae.domainlayer.planner.application.port.in;

import com.hondigagae.domainlayer.planner.adapter.in.web.dto.response.AiPlanJobStatusResponse;
import com.hondigagae.domainlayer.planner.adapter.in.web.dto.response.PackingListResponse;
import com.hondigagae.domainlayer.planner.application.info.AiPlanJobInfo;
import com.hondigagae.domainlayer.planner.application.model.AiPlanJobSubscription;
import java.util.function.Consumer;
import com.hondigagae.domainlayer.planner.adapter.in.web.dto.response.AiPlanSubmitResponse;
import com.hondigagae.domainlayer.planner.application.command.AiPlanCreateCommand;

public interface AiPlanWebUseCase {

    AiPlanSubmitResponse submitPlan(long memberId, AiPlanCreateCommand command);

    AiPlanJobStatusResponse getJobStatus(String jobId, long memberId);

    /**
     * 작업 취소. 실행 중인 LLM 호출을 끊지는 못하고, 단계 경계에서 워커가 협조적으로 선다.
     * 이미 끝난 작업은 AIPLAN_019 (409) 다.
     */
    AiPlanJobStatusResponse cancelJob(String jobId, long memberId);

    /**
     * 반려견 여행 준비물 목록 생성. 일정 생성과 달리 동기다 — 출력이 짧아 잡·SSE 인프라를
     * 얹는 비용이 이득보다 크다. LLM 응답이 수십 초일 수 있다.
     */
    PackingListResponse generatePackingList(long memberId, long planId);

    /** SSE 스트리머용 상태 스냅샷. 소유권 검증과 멈춘 잡 만료 처리는 getJobStatus 와 같은 경로를 탄다. */
    AiPlanJobInfo getJobInfo(String jobId, long memberId);

    /**
     * 잡 상태 변경 구독. 이벤트 수신 시마다 저장소에서 최신 상태를 다시 읽어 전달하므로
     * pub/sub 메시지 자체에는 상태를 싣지 않는다(발행-저장 순서 역전, 스키마 드리프트 방지).
     */
    AiPlanJobSubscription subscribeJobUpdates(String jobId, long memberId, Consumer<AiPlanJobInfo> onUpdate);
}
