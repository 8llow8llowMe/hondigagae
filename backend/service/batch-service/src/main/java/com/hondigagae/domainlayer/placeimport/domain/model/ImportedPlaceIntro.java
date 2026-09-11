package com.hondigagae.domainlayer.placeimport.domain.model;

import lombok.Builder;

/**
 * TourAPI detailIntro2 로 수집한 장소 상세 소개 한 건.
 *
 * <p>placeId 를 들지 않는다 — 이 모델은 "원천이 말해 준 내용"이고, 어느 장소의 것인지는
 * 쓰기 포트가 {@code placeId} 를 따로 받아 맞춘다 ({@code ImportedPlaceImage} 와 같은 결).
 *
 * <p>{@code weeklyHoursSpec} 과 {@code open24} 는 원천 필드가 아니라 {@code useTime} 원문을
 * {@link OperatingHoursParser} 로 해석한 파생값이다. 못 풀면 {@code weeklyHoursSpec} 은 null 로
 * 남는다 — 모름을 닫힘으로 표시하지 않기 위해서다.
 */
@Builder
public record ImportedPlaceIntro(
    String infoCenter,
    String useTime,
    String weeklyHoursSpec,
    boolean open24,
    String restDate,
    String parking,
    String chkPet,
    String chkBabyCarriage,
    String chkCreditCard,
    String rawJson
) {

}
