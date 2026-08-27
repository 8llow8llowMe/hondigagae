package com.hondigagae.domainlayer.plan.adapter.out.client.feign.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * auth-service 반려견 특성 응답의 Feign 전용 표현.
 *
 * <p>enum 을 문자열로 받는다. 상대 서비스가 값을 추가해도 이쪽 역직렬화가 깨지지 않게 하기
 * 위해서다 - enum 으로 받으면 새 값 하나에 전체 조회가 500 이 된다.
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
