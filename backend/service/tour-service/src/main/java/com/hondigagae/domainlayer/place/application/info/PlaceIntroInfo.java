package com.hondigagae.domainlayer.place.application.info;

import lombok.Builder;

@Builder
public record PlaceIntroInfo(
    String infoCenter,
    String useTime,
    // 지금 영업 중 여부. null = 판정 근거 없음 — "닫힘"과 다르다
    Boolean openNow,
    boolean open24,
    String restDate,
    String parking,
    String chkPet,
    String chkBabyCarriage,
    String chkCreditCard
) {

}
