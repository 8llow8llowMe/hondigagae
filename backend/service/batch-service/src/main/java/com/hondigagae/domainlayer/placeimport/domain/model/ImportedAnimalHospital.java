package com.hondigagae.domainlayer.placeimport.domain.model;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Builder;

/**
 * 문화정보원 CSV 의 동물병원 한 행.
 *
 * <p>여행 장소가 아니라 긴급 상황용 시설이라 place 가 아닌 별도 테이블에 적재한다.
 *
 * <p>제주 CSV 에는 225행이 있지만 이름·주소·좌표가 완전히 같은 중복이 139건이라
 * {@code sourceKey}(이름+주소 해시)로 upsert 하면 실제 86곳으로 정리된다.
 */
@Builder
public record ImportedAnimalHospital(
    String sourceKey,
    String name,
    String addr,
    String sigunguCode,
    BigDecimal lat,
    BigDecimal lng,
    String tel,
    // 원천이 "정보없음"으로 주는 경우가 절반이라 null 을 허용한다.
    String operatingHours,
    String restDate,
    boolean open24,
    LocalDateTime sourceModifiedAt
) {

    public long hospitalId() {
        return PlaceIdFactory.create(
            com.hondigagae.domainlayer.placeimport.domain.enums.PlaceSourceType.CULTURE_PORTAL,
            "HOSPITAL|" + sourceKey);
    }
}
