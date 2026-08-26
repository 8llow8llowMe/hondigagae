package com.hondigagae.domainlayer.dining.application.model;

import com.hondigagae.domainlayer.dining.domain.enums.DiningType;
import lombok.Builder;

/**
 * 주변 식음료 검색 조건. 좌표 + 반경 + 종류가 함께 움직여 Criteria 로 묶는다.
 */
@Builder
public record NearbyDiningQuery(
    double lat,
    double lng,
    int radius,
    DiningType diningType,
    // 있으면 키워드 검색, 없으면 카테고리 검색을 쓴다.
    String keyword,
    int size
) {

}
