package com.hondigagae.domainlayer.insight.application.model;

import com.hondigagae.domainlayer.insight.domain.model.PetCondition;
import java.time.LocalDate;
import lombok.Builder;

/**
 * 장소 추천 조회 조건 (#1368). 적합도 한 곳 조회와 같은 날짜 · 반려견 조건에 개수만 더했다.
 *
 * @param targetDate null 이면 오늘 기준
 * @param limit      추천 개수. 범위(1~10)는 컨트롤러가 검증한다
 */
@Builder
public record PlaceRecommendationQuery(
    LocalDate targetDate,
    PetCondition petCondition,
    int limit
) {

    public LocalDate resolvedDate() {
        return targetDate != null ? targetDate : LocalDate.now();
    }
}
