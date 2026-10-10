package com.hondigagae.domainlayer.place.application.port.out.query;

import lombok.Builder;

@Builder
public record PlaceImageQueryResult(
    String originImgUrl,
    String smallImageUrl,
    String imgName,
    String cpyrhtDivCd
) {

}
