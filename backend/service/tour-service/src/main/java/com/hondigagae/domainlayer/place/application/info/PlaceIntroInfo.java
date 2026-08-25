package com.hondigagae.domainlayer.place.application.info;

import lombok.Builder;

@Builder
public record PlaceIntroInfo(
    String infoCenter,
    String useTime,
    String restDate,
    String parking,
    String chkPet,
    String chkBabyCarriage,
    String chkCreditCard
) {

}
