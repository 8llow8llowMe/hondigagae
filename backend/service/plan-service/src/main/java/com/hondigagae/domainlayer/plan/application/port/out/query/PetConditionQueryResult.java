package com.hondigagae.domainlayer.plan.application.port.out.query;

import lombok.Builder;

/**
 * 판정에 쓰는 반려견 특성. 원천은 auth-service 다.
 *
 * <p>{@code sizeType} / {@code activityLevel} 을 문자열로 들고 있는 이유는 이 서비스가 그 값을
 * <b>해석하지 않고 전달만 하기 때문</b>이다. 해석은 tour-service 의 판정 로직이 한다.
 * 중간에서 enum 으로 바꾸면 상대가 값을 늘릴 때마다 이쪽이 먼저 깨진다.
 */
@Builder
public record PetConditionQueryResult(
    String breed,
    String sizeType,
    boolean heatSensitive,
    boolean coldSensitive,
    boolean noiseSensitive,
    String activityLevel
) {

    /** 조회에 실패했을 때 쓰는 값. 반려견 특성 없이도 날씨 브리핑은 나가야 한다. */
    public static PetConditionQueryResult unknown() {
        return PetConditionQueryResult.builder().build();
    }
}
