package com.hondigagae.domainlayer.planner.application.info;

import com.hondigagae.domainlayer.planner.domain.model.AiPlanJobStatus;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJobStep;
import java.time.Instant;
import lombok.Builder;

@Builder
public record AiPlanJobInfo(
    String jobId,
    AiPlanJobStatus status,
    // 지금 밟고 있는 세부 단계. 아직 시작하지 않았으면 null 이다.
    AiPlanJobStep step,
    // 현재 단계에 들어간 서버 시각 (#985). RUNNING 이고 단계가 있을 때만 채운다 — 대기 중에는 단계가 없고,
    // 종결이면 더 흐르는 시간이 없다.
    Instant stepStartedAt,
    // 일정을 만들 때 쓴 생성 조건. 상태와 무관하게 항상 채운다 — 브라우저를 넘어온 화면이
    // 초안을 담으려면 조건이 필요한데, 그것만 별도 조회로 가져올 수단이 없다 (#488).
    AiPlanConditionsInfo conditions,
    AiPlanDraftInfo planDraft,
    // 이 작업의 초안을 담아 만든 일정 (#970). COMPLETED 이고 담은 적이 있을 때만 채운다.
    // 정본은 plan-service 라 잡에 저장하지 않고 조회 때마다 물어 온다. 못 물으면 null 이다.
    Long committedPlanId,
    String errorCode,
    String errorMessage
) {

}
