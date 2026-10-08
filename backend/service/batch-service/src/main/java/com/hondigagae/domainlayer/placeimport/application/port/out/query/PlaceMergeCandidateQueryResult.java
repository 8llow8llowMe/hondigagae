package com.hondigagae.domainlayer.placeimport.application.port.out.query;

import java.math.BigDecimal;

/**
 * 중복 병합 판정에 필요한 최소 정보. 전체 컬럼을 끌어오지 않는다.
 *
 * <p>{@code contentTypeId} 는 종류 가드(숙박 · 코스, #1282)에 쓴다. 문화정보원 행도 분류를 관광 API 체계로
 * 맞춘 이 값을 갖는다({@code CultureCategoryMapping}).
 */
public record PlaceMergeCandidateQueryResult(
    long id,
    String source,
    String title,
    String contentTypeId,
    BigDecimal lat,
    BigDecimal lng
) {

}
