package com.hondigagae.domainlayer.placeimport.domain.model;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Builder;

/**
 * TourAPI 목록 응답을 적재용으로 정규화한 장소.
 *
 * <p>좌표는 원천 필드명(mapx=경도, mapy=위도)의 혼동을 막기 위해 lat/lng로 바꿔 들고 다닌다.
 */
@Builder
public record ImportedPlace(
    long contentId,
    String contentTypeId,
    String title,
    String addr1,
    String addr2,
    String zipcode,
    String areaCode,
    String sigunguCode,
    String ldongRegnCd,
    String ldongSignguCd,
    String cat1,
    String cat2,
    String cat3,
    String lclsSystm1,
    String lclsSystm2,
    String lclsSystm3,
    BigDecimal lat,
    BigDecimal lng,
    Integer mlevel,
    String firstImage,
    String firstImage2,
    String cpyrhtDivCd,
    String tel,
    LocalDateTime sourceCreatedAt,
    LocalDateTime sourceModifiedAt
) {

    /**
     * {@code place.source_category} 로 싣는 원천 분류. 분류 코드가 카페면 '카페', 아니면 null 이다 (#1473, {@link TourApiCafeClassPolicy}).
     *
     * <p>필드로 따로 들고 다니지 않고 {@code cat3} · {@code lclsSystm2} 에서 매번 끌어낸다 — 같은 레코드 안에서 분류 코드와 원천 분류가 어긋날 수 없다.
     */
    public String sourceCategory() {
        return TourApiCafeClassPolicy.sourceCategoryOf(lclsSystm2, cat3);
    }
}
