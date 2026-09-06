package com.hondigagae.domainlayer.place.adapter.in.web.dto.item;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

@Builder
@Schema(description = "장소 소개 정보")
public record PlaceIntroItem(

    @Schema(description = "문의처", example = "064-760-6331")
    String infoCenter,

    @Schema(description = "운영시간", example = "09:00~17:50 (입장 마감 17:10)")
    String useTime,

    @Schema(description = "지금 영업 중 여부. null 은 판정 근거 없음(운영시간을 구조화하지 못한 곳) — 닫힘과 다르다", example = "true")
    Boolean openNow,

    @Schema(description = "24시간 운영 여부", example = "false")
    boolean open24,

    @Schema(description = "휴무일", example = "연중무휴")
    String restDate,

    @Schema(description = "주차", example = "가능")
    String parking,

    @Schema(description = "애완동물 동반 가능 원문 (빈 값 가능 — 판단은 petInfo 우선)")
    String chkPet,

    @Schema(description = "유모차 대여")
    String chkBabyCarriage,

    @Schema(description = "신용카드 가능")
    String chkCreditCard
) {

}
