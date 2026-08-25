package com.hondigagae.domainlayer.planner.application.model;

import lombok.Builder;

/**
 * LLM 일정 생성에 전달하는 질의 모델. 개인정보(회원 식별 정보)는 싣지 않는다.
 */
@Builder
public record AiPlanGenerationQuery(
    String areaCode,
    String startDate,
    String endDate,
    String budget,
    String petId,
    String requestNote
) {

}
