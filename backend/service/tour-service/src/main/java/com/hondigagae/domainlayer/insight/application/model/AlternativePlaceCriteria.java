package com.hondigagae.domainlayer.insight.application.model;

import lombok.Builder;

/**
 * 실내 대안 검색 조건. 중심 좌표 + 반경 + 제외 대상 + 개수가 함께 움직여 Criteria 로 묶는다
 * (coding-conventions §3).
 */
@Builder
public record AlternativePlaceCriteria(
    double lat,
    double lng,
    int radiusMeters,
    // 대안을 찾는 그 장소 자신은 후보에서 뺀다.
    long excludePlaceId,
    int size
) {

}
