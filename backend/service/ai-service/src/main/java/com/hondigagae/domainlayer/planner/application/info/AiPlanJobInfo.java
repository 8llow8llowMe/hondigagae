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
    // 일정을 만들 때 쓴 생성 조건. 상태와 무관하게 항상 채운다 — 브라우저를 넘어온 화면이
    // 초안을 담으려면 조건이 필요한데, 그것만 별도 조회로 가져올 수단이 없다 (#488).
    AiPlanConditionsInfo conditions,
    AiPlanDraftInfo planDraft,
    String errorCode,
    String errorMessage
) {

}
