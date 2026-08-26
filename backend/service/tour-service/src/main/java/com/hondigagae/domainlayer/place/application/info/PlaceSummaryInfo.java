package com.hondigagae.domainlayer.place.application.info;

import com.hondigagae.domainlayer.place.domain.enums.ContentType;
import com.hondigagae.domainlayer.place.domain.enums.PetAllowanceType;
import com.hondigagae.domainlayer.place.domain.enums.PlaceSource;
import java.math.BigDecimal;
import lombok.Builder;

@Builder
public record PlaceSummaryInfo(
    long placeId,
    ContentType contentType,
    String title,
    String addr1,
    String sigunguCode,
    BigDecimal lat,
    BigDecimal lng,
    String firstImage,
    String firstImage2,
    PetAllowanceType petAllowanceType,
    String tel,
    Boolean indoor,
    String sourceCategory,
    PlaceSource source
) {

}
