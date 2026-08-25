package com.hondigagae.domainlayer.place.application.port.out.query;

import lombok.Builder;

@Builder
public record PlaceIntroQueryResult(
    String infoCenter,
    String useTime,
    String restDate,
    String parking,
    String chkPet,
    String chkBabyCarriage,
    String chkCreditCard
) {

}
