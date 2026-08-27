package com.hondigagae.domainlayer.placeimport.domain.model;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Builder;

/**
 * 한국문화정보원 "전국 반려동물 동반 가능 문화시설" CSV 한 행을 적재용으로 정규화한 장소.
 *
 * <p>관광 API 와 달리 원천에 안정적인 식별자가 없어 {@code sourceKey} 를 시설명+주소 해시로 만든다
 * ({@link PlaceIdFactory#sourceKeyOf}).
 *
 * <p>반려동물 관련 값은 원문과 가공값을 함께 들고 간다. 관광 API 행과 달리 이 원천은
 * 동반 가능 여부를 자기 컬럼으로 갖고 있어 upsert 의 UPDATE 절에서도 갱신한다.
 */
@Builder
public record ImportedCultureFacility(
    String sourceKey,
    // 원본 분류(펜션·카페·박물관 …). contentTypeId 로 뭉개기 전 값을 보존한다.
    String sourceCategory,
    String contentTypeId,
    String title,
    String addr1,
    String zipcode,
    String areaCode,
    String sigunguCode,
    BigDecimal lat,
    BigDecimal lng,
    String tel,
    String homepage,
    String overview,
    boolean petAvailable,
    String petAllowanceType,
    boolean indoor,
    boolean outdoor,
    boolean petOnly,
    String allowedPetSize,
    // 원문에 kg 숫자가 있으면 보존한다. enum 은 10kg 경계로 뭉개져 체중 필터에 못 쓴다.
    Integer maxPetWeightKg,
    String petRestriction,
    String petExtraFee,
    String useTime,
    String restDate,
    String parking,
    String admissionFee,
    LocalDateTime sourceModifiedAt
) {

    public long placeId() {
        return PlaceIdFactory.create(
            com.hondigagae.domainlayer.placeimport.domain.enums.PlaceSourceType.CULTURE_PORTAL, sourceKey);
    }
}
