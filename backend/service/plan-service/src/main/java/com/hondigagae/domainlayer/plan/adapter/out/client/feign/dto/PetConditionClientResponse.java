package com.hondigagae.domainlayer.plan.adapter.out.client.feign.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * auth-service 반려견 특성 응답의 Feign 전용 표현.
 *
 * <p>enum 을 문자열로 받는다. 상대 서비스가 값을 추가해도 이쪽 역직렬화가 깨지지 않게 하기
 * 위해서다 - enum 으로 받으면 새 값 하나에 전체 조회가 500 이 된다.
 *
 * <p><b>{@code walkPreferred} 는 일부러 {@code PetConditionQueryResult} 로 옮기지 않는다.</b>
 * 이 DTO 가 받아 두기만 하고 어디로도 가지 않는 유일한 칸이라 #759 의 훑기에 걸렸는데, 이쪽은
 * 같은 사고가 아니다 — plan-service 가 이 특성으로 무엇을 묻는 자리가 없다. 적합도·산책
 * 위험도·골든타임이 tour-service 에 넘기는 질의 파라미터는 {@code sizeType} ·
 * {@code heatSensitive} · {@code coldSensitive} · {@code noiseSensitive} ·
 * {@code activityLevel} · {@code breed} 뿐이고, 산책 선호 여부를 받는 엔드포인트가 없다.
 * 소비처가 생기면 그때 {@code QueryResult} 에 칸을 내면 된다 — 지금 이어 두면 아무도 읽지 않는
 * 값이 계층을 하나 더 건너간다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record PetConditionClientResponse(
    String petId,
    String breed,
    String sizeType,
    boolean heatSensitive,
    boolean coldSensitive,
    boolean noiseSensitive,
    String activityLevel,
    boolean walkPreferred
) {

}
