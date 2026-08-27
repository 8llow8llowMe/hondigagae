package com.hondigagae.domainlayer.place.domain.model;

import com.hondigagae.shared.travel.place.AllowedPetSize;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import com.hondigagae.domainlayer.place.domain.enums.PlaceSource;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Builder;

@Builder
public record Place(
    long id,
    PlaceSource source,
    String sourceKey,
    String sourceCategory,
    // 문화정보원 원천이면 null 이라 wrapper 로 둔다
    Long contentId,
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
    Boolean indoor,
    Boolean outdoor,
    boolean petOnly,
    AllowedPetSize allowedPetSize,
    Integer maxPetWeightKg,
    String petRestriction,
    String petExtraFee,
    Long mergedIntoId,
    LocalDateTime delistedAt,
    LocalDateTime sourceCreatedAt,
    LocalDateTime sourceModifiedAt
) {

}
