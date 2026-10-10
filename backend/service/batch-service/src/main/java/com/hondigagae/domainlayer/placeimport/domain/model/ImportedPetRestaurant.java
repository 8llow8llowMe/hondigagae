package com.hondigagae.domainlayer.placeimport.domain.model;

import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceSourceType;
import java.math.BigDecimal;
import lombok.Builder;
import lombok.With;

/**
 * 식약처 "반려동물 동반출입 음식점" 등록 업소 한 건.
 *
 * <p>이 원천의 강점과 약점이 뚜렷하다.
 * <ul>
 *   <li><b>강점</b> — 영업자가 지자체에 등록을 신청해 수리된 업소라, 동반 가능 여부가 행정적으로 확정이다.
 *       추측이 섞이지 않는다.</li>
 *   <li><b>약점</b> — 업소명·업종·지역·주소 네 값이 전부다. 좌표·전화·영업시간이 없다.
 *       좌표는 {@link com.hondigagae.domainlayer.placeimport.application.port.out.GeocodingPort} 로 채운다.</li>
 * </ul>
 *
 * <p>실내/실외와 크기 제한은 원천에 없으므로 <b>추정하지 않고 비워 둔다</b>. place 의 indoor 가
 * nullable 인 이유가 이것이다 — "실외"와 "정보 없음"은 다르다.
 */
@Builder
public record ImportedPetRestaurant(
    String sourceKey,
    String name,
    // 일반음식점 / 휴게음식점 / 제과점영업. contentTypeId 로 뭉개기 전 원본 분류를 보존한다.
    String businessType,
    String address,
    String areaCode,
    String sigunguCode,
    @With BigDecimal lat,
    @With BigDecimal lng
) {

    /** 관광 API contentTypeId 기준 음식점. 세 업종 모두 여기로 모인다. */
    public static final String CONTENT_TYPE_RESTAURANT = "39";

    public long placeId() {
        return PlaceIdFactory.create(PlaceSourceType.MFDS, sourceKey);
    }

    public boolean hasCoordinate() {
        return lat != null && lng != null;
    }
}
