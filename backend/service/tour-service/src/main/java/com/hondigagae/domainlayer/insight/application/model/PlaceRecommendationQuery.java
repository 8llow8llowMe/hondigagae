package com.hondigagae.domainlayer.insight.application.model;

import com.hondigagae.domainlayer.insight.domain.model.PetCondition;
import java.time.LocalDate;
import lombok.Builder;

/**
 * 장소 추천 조회 조건 (#1368). 적합도 한 곳 조회와 같은 날짜 · 반려견 조건에 개수만 더했다.
 *
 * @param targetDate   null 이면 오늘 기준
 * @param limit        추천 개수. 범위(1~10)는 컨트롤러가 검증한다
 * @param refreshCache 결과 캐시를 읽지 않고 새로 계산해 캐시에 쓴다. 예열(#1388) 전용이고 사용자 요청은 늘 false 다 —
 *                     캐시 적중으로 계산을 건너뛰면 예열이 날씨 격자를 하나도 새로 받지 않는다
 */
@Builder
public record PlaceRecommendationQuery(
    LocalDate targetDate,
    PetCondition petCondition,
    int limit,
    boolean refreshCache
) {

    /**
     * 추천 개수 기본값. 컨트롤러 {@code limit} 의 기본값이자 예열이 채우는 개수다 — 둘이 어긋나면 예열이 홈 화면이 읽지 않는
     * 키에 결과를 넣는다.
     */
    public static final int DEFAULT_LIMIT = 3;

    /** 예열 조건 — 오늘 · 반려견 조건 없음 · 기본 개수. 홈 첫 화면의 기본 요청과 같은 캐시 키다 (#1388). */
    public static PlaceRecommendationQuery prewarmToday() {
        return PlaceRecommendationQuery.builder()
            .petCondition(PetCondition.unspecified())
            .limit(DEFAULT_LIMIT)
            .refreshCache(true)
            .build();
    }

    public LocalDate resolvedDate() {
        return targetDate != null ? targetDate : LocalDate.now();
    }
}
