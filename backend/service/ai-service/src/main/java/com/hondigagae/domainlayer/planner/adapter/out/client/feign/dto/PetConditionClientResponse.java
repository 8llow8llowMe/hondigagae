package com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto;

/**
 * auth-service 내부 API 원본 응답. 이 어댑터 밖으로 새지 않는다 —
 * application 계층에는 {@code PetCondition} 만 넘긴다.
 */
public record PetConditionClientResponse(
    String petId,
    String breed,
    String sizeType,
    java.math.BigDecimal weightKg,
    boolean heatSensitive,
    boolean coldSensitive,
    boolean noiseSensitive,
    String activityLevel,
    boolean walkPreferred
) {
}
