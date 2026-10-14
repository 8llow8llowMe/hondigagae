package com.hondigagae.domainlayer.place.domain.enums;

import com.hondigagae.common.dto.metadata.CodeNameDescribable;
import com.hondigagae.domainlayer.place.application.exception.PlaceErrorCode;
import com.hondigagae.domainlayer.place.application.exception.PlaceException;
import java.util.Arrays;
import java.util.Optional;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * TourAPI 콘텐츠 타입. code 는 원천 contenttypeid 값이라 enum.name() 만으로 표현할 수 없어 별도로 둔다.
 */
@Getter
@RequiredArgsConstructor
public enum ContentType implements CodeNameDescribable {

    TOURIST_SPOT("12", "관광지", "자연·문화 관광지"),
    CULTURE("14", "문화시설", "박물관, 미술관 등 문화시설"),
    FESTIVAL("15", "축제공연행사", "축제, 공연, 행사"),
    COURSE("25", "여행코스", "TourAPI 제공 여행 코스"),
    LEPORTS("28", "레포츠", "레저 및 스포츠 시설"),
    LODGING("32", "숙박", "호텔, 펜션 등 숙박 시설"),
    SHOPPING("38", "쇼핑", "시장, 상점 등 쇼핑 시설"),
    RESTAURANT("39", "음식점", "음식점, 카페");

    private final String code;
    private final String displayName;
    private final String description;

    public static ContentType fromCode(String code) {
        return findByCode(code).orElseThrow(() -> new PlaceException(PlaceErrorCode.CONTENT_TYPE_INVALID));
    }

    /**
     * 모르는 코드거나 null 이면 비어 있다. 장소 하나의 유형을 몰라도 응답 전체가 깨지면 안 되는 부가 칸(실내 대안 등, #1461)에
     * 쓴다 — 요청 값 검증처럼 틀린 코드를 거절해야 하는 자리는 {@link #fromCode} 를 쓴다.
     */
    public static Optional<ContentType> findByCode(String code) {
        return Arrays.stream(values())
            .filter(type -> type.code.equals(code))
            .findFirst();
    }
}
