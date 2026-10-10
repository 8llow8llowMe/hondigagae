package com.hondigagae.domainlayer.planner.application.model;

import java.util.List;
import lombok.Builder;

/**
 * 준비물 생성에 전달하는 질의 모델. 개인정보(회원 식별 정보)는 싣지 않는다.
 *
 * <p>일정 개요·반려견 특성·날씨 전망이 셋 다 근거다 — 어느 하나가 빠지면 그만큼
 * 일반적인 목록이 되지만 생성 자체는 계속한다 (반려견 특성과 같은 관용 원칙).
 */
@Builder
public record PackingChecklistQuery(
    String startDate,
    String endDate,
    List<PetCondition> petConditions,
    List<DayWeatherOutlook> weatherOutlook,
    PlanOutline planOutline
) {

    public List<PetCondition> safePetConditions() {
        return petConditions == null ? List.of() : petConditions;
    }

    public List<DayWeatherOutlook> safeWeatherOutlook() {
        return weatherOutlook == null ? List.of() : weatherOutlook;
    }
}
