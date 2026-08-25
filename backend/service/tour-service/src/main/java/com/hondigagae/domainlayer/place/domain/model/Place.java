package com.hondigagae.domainlayer.place.domain.model;

import com.hondigagae.domainlayer.place.domain.enums.PetAllowanceType;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Builder;

@Builder
public record Place(
    long id,
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
    String homepage,
    String overview,
    boolean petAvailable,
    PetAllowanceType petAllowanceType,
    LocalDateTime sourceCreatedAt,
    LocalDateTime sourceModifiedAt
) {

}
