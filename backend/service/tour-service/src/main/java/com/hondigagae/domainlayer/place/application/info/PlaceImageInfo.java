package com.hondigagae.domainlayer.place.application.info;

import lombok.Builder;

@Builder
public record PlaceImageInfo(
    String originImgUrl,
    String smallImageUrl,
    String imgName,
    String cpyrhtDivCd
) {

}
