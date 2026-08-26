package com.hondigagae.domainlayer.place.domain.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 장소 원천. 원천마다 식별자 체계가 달라 {@code (source, sourceKey)} 를 장소의 고유 키로 쓴다.
 */
@Getter
@RequiredArgsConstructor
public enum PlaceSource {

    TOUR_API("관광정보 API", "한국관광공사 국문 관광정보·반려동물 동반여행 서비스"),
    CULTURE_PORTAL("문화정보원", "한국문화정보원 전국 반려동물 동반 가능 문화시설 위치 데이터"),
    MFDS("식약처", "식품의약품안전처 반려동물 동반출입 음식점 등록 현황 (지자체 등록 기반)");

    private final String displayName;
    private final String description;
}
