package com.hondigagae.domainlayer.planner.application.model;

import java.util.List;
import lombok.Builder;

/**
 * LLM 일정 생성에 전달하는 질의 모델. 개인정보(회원 식별 정보)는 싣지 않는다.
 *
 * <p>{@code placeCandidates} 가 이 모델에서 가장 중요한 부분이다. 후보를 함께 넘기지 않으면
 * LLM 은 제주 관광지를 <b>기억으로</b> 답하고, 존재하지 않는 카페나 반려견을 받지 않는 곳이
 * 일정에 섞인다. 실제 DB 에 있는 동반 가능 장소만 주고 그 안에서 고르게 한다.
 */
@Builder
public record AiPlanGenerationQuery(
    String areaCode,
    String startDate,
    String endDate,
    String budget,
    String petId,
    String requestNote,
    // 반려견 특성. null 이면 조회 실패/프로필 부재 — 특성 없이 생성하되 프롬프트에서 반려견 절이 빠진다.
    PetCondition petCondition,
    // 일정에 넣을 수 있는 장소 전부. 비어 있으면 생성 자체를 하지 않는다.
    List<PlaceCandidate> placeCandidates
) {

    public List<PlaceCandidate> safeCandidates() {
        return placeCandidates == null ? List.of() : placeCandidates;
    }
}
