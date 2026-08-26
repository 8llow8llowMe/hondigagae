package com.hondigagae.domainlayer.placeimport.domain.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 장소 원천. tour-service 의 {@code PlaceSource} 와 코드 문자열을 맞춘다.
 *
 * <p>원천마다 식별자 체계가 달라 {@code (source, sourceKey)} 를 place 테이블의 고유 키로 쓴다.
 */
@Getter
@RequiredArgsConstructor
public enum PlaceSourceType {

    TOUR_API("관광정보 API"),
    CULTURE_PORTAL("문화정보원");

    private final String displayName;
}
