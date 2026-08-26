package com.hondigagae.domainlayer.dining.application.port.out.query;

import lombok.Builder;

/**
 * 주변 식음료 한 건. 원본 응답 DTO 는 어댑터 안에 갇히고 이 타입만 application 으로 나온다.
 */
@Builder
public record NearbyDiningQueryResult(
    String name,
    String address,
    String roadAddress,
    double lat,
    double lng,
    String phone,
    String category,
    // 제공처 상세 페이지 링크. 출처 표시 의무가 있어 반드시 응답에 실어 보낸다.
    String detailUrl,
    int distanceMeters
) {

}
