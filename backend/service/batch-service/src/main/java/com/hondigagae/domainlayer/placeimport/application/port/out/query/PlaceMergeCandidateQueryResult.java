package com.hondigagae.domainlayer.placeimport.application.port.out.query;

import java.math.BigDecimal;

/**
 * 중복 병합 판정에 필요한 최소 정보. 전체 컬럼을 끌어오지 않는다.
 */
public record PlaceMergeCandidateQueryResult(
    long id,
    String source,
    String title,
    BigDecimal lat,
    BigDecimal lng
) {

}
