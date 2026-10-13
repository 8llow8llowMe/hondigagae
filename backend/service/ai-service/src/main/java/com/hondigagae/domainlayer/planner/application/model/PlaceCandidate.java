package com.hondigagae.domainlayer.planner.application.model;

import com.hondigagae.shared.travel.place.AllowedPetSize;
import lombok.Builder;

/**
 * 프롬프트에 실을 후보 장소 (application model).
 *
 * <p>포트가 준 {@code QueryResult} 를 그대로 프롬프트까지 들고 가지 않는다 -
 * QueryResult 는 어댑터 경계의 표현이고, 프롬프트 조립까지 번지면 안 된다
 * (architecture-guide §4).
 *
 * <p>입장 크기는 표시명이 아니라 enum 으로 든다 — 동행견 입장 판정({@link PetAdmission}, #1420)이
 * tour-service 와 같은 {@link AllowedPetSize#allows} 로 판정하고, 프롬프트는 표시명을 꺼내 쓴다.
 */
@Builder
public record PlaceCandidate(
    long placeId,
    String title,
    String contentTypeName,
    String addr,
    String petAllowanceName,
    // 입장 가능 크기 / 체중 상한(kg, 포함). null 이면 그 제한 정보가 없다 — 막지 않는다.
    AllowedPetSize allowedPetSize,
    Integer maxPetWeightKg,
    Boolean indoor,
    String sourceCategory,
    Double lat,
    Double lng
) {

    /** 실내 여부를 사람이 읽는 표현으로. null 은 모른다는 뜻이지 실외라는 뜻이 아니다. */
    public String indoorText() {
        if (indoor == null) {
            return "실내외 정보없음";
        }
        return indoor ? "실내" : "실외";
    }
}
