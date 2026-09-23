package com.hondigagae.domainlayer.placeimport.domain.model;

import lombok.Builder;

/**
 * 반려동물 동반여행 API(detailPetTour2) 로 수집한 동반 조건 한 건 (#877).
 *
 * <p>placeId 를 들지 않는다 — 어느 장소의 것인지는 쓰기 포트가 {@code placeId} 를 따로 받아
 * 맞춘다 ({@link ImportedPlaceIntro} 와 같은 결).
 *
 * <p>앞의 아홉 칸은 <b>원천 원문 그대로</b>다. 전부 자유 텍스트라(코드값이 아니다) 적재 단계에서
 * 고치지 않는다 ({@code entity-design.md} §3 "원문 보존").
 *
 * <p>뒤의 세 칸({@code allowanceScope}·{@code allowedPetSize}·{@code leashRequired})은
 * {@code place_pet_info} 가 NOT NULL 로 요구하는 가공값이다. 새 규칙을 만들지 않고
 * {@link PetFieldParser} 에 이미 있는 규칙으로만 채운다 — 모르면 {@code UNKNOWN}/{@code false} 다.
 * {@code place} 행의 필터·적합도 컬럼({@code pet_allowance_type}·{@code allowed_pet_size})은
 * 이 모델이 건드리지 않는다. 규칙을 넓혀 그쪽까지 잇는 것은 별도 이슈다.
 *
 * @param allowanceScope tour-service {@code PetAllowanceScope} enum 이름
 * @param allowedPetSize tour-service {@code AllowedPetSize} enum 이름
 */
@Builder
public record ImportedPlacePetInfo(
    String acmpyTypeCd,
    String acmpyPsblCpam,
    String acmpyNeedMtr,
    String etcAcmpyInfo,
    String relaAcdntRiskMtr,
    String relaFrnshPrdlst,
    String relaPosesFclty,
    String relaPurcPrdlst,
    String relaRntlPrdlst,
    String allowanceScope,
    String allowedPetSize,
    boolean leashRequired
) {

}
