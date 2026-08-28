package com.hondigagae.domainlayer.planner.application.port.out.query;

import lombok.Builder;

/**
 * LLM 에게 보여 줄 후보 장소 한 건.
 *
 * <p>tour-service 의 장소 응답 스키마 전체를 끌고 오지 않는다. 프롬프트에 넣을 것만 추린다 -
 * 토큰이 곧 비용이고, 모델에게 필요 없는 필드는 판단을 흐리기만 한다.
 */
@Builder
public record PlaceCandidateQueryResult(
    long placeId,
    String title,
    String contentTypeName,
    String addr,
    String petAllowanceName,
    // 입장 가능 크기 표시명 / 체중 상한(kg). 없으면 제한 정보 없음이다.
    String allowedPetSizeName,
    Integer maxPetWeightKg,
    // 원천에 정보가 없으면 null 이다. 비 오는 날 대안 판단에 쓰이므로 모른다는 사실을 그대로 넘긴다.
    Boolean indoor,
    String sourceCategory,
    Double lat,
    Double lng
) {

}
