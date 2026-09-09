package com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * auth-service 내부 API 원본 응답. 이 어댑터 밖으로 새지 않는다 —
 * application 계층에는 {@code PetCondition} 만 넘긴다.
 *
 * <p>원천이 필드를 더해도 깨지지 않게 모르는 속성은 무시한다 — plan-service 의 같은 사본과 같은 결정이다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record PetConditionClientResponse(
    String petId,
    String breed,
    String sizeType,
    java.math.BigDecimal weightKg,
    Integer ageMonths,
    boolean heatSensitive,
    boolean coldSensitive,
    boolean noiseSensitive,
    String activityLevel,
    boolean walkPreferred
) {
}
