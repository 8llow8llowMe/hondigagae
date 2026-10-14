package com.hondigagae.domainlayer.placeimport.domain.model;

/**
 * 보정이 읽고 쓰는 place 행 한 줄 — id · 제목과 보정이 다루는 다섯 칸 (#1434).
 *
 * <p>지금 값과 보정 값을 합치는 일은 Java({@link PlaceOverride#applyTo})가 한다. 어댑터는 합친 결과를 평범한 파라미터로 그대로 쓴다 —
 * SQL 에서 {@code COALESCE(?, col)} 로 합치면 MySQL 의 {@code BIT(1)} 칸과 Connector/J 가 보내는 정수가 문자열로 형 병합돼
 * {@code '0'} 을 {@code BIT(1)} 에 넣으려다 실패하거나 1 로 포화될 수 있다.
 *
 * @param placeId          {@code place.id}
 * @param title            {@code place.title} — 쓰기에서 한 번 더 거는 조건이다
 * @param indoor           null 이면 모름
 * @param outdoor          null 이면 모름
 * @param petAllowanceType {@code place.pet_allowance_type} 원문
 * @param allowedPetSize   {@code place.allowed_pet_size} 원문
 * @param petAvailable     {@code place.pet_available}
 */
public record OverridablePlace(
    long placeId, String title, Boolean indoor, Boolean outdoor, String petAllowanceType, String allowedPetSize, boolean petAvailable
) {
}
