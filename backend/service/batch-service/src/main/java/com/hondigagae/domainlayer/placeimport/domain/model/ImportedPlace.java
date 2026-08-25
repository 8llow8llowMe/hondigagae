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

}
