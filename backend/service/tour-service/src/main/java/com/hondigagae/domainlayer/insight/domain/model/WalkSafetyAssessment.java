package com.hondigagae.domainlayer.insight.domain.model;

import com.hondigagae.shared.travel.insight.WalkSafetyLevel;
import java.time.LocalTime;
import java.util.List;
import lombok.Builder;

/**
 * 산책 위험도 판정 결과.
 *
 * <p>{@code saferWindow} 가 이 응답의 실질적인 값어치다. "위험합니다"만 말하면 사용자는
 * 할 수 있는 것이 없다. "지금은 위험하지만 18시 이후는 괜찮다"고 말해야 일정을 옮길 수 있다.
 */
@Builder
public record WalkSafetyAssessment(
    WalkSafetyLevel level,
    List<WalkSafetyReason> reasons,
    // 추정 노면온도. 판단의 핵심 근거라 값 자체를 함께 내린다.
    Double estimatedPavementCelsius,
    // 기상청 여름철 체감온도 — 판정에 쓴 값이다.
    Double feelsLikeCelsius,
    // NOAA 열지수 — 판정에 쓰지 않는 참고 병기 값이다.
    Double heatIndexCelsius,
    // 같은 날 안에서 더 안전한 시간대. 없으면 둘 다 null 이다.
    LocalTime saferWindowStart,
    LocalTime saferWindowEnd
) {

    public static WalkSafetyAssessment unknown(List<WalkSafetyReason> reasons) {
        return WalkSafetyAssessment.builder()
            .level(WalkSafetyLevel.UNKNOWN)
            .reasons(reasons)
            .build();
    }

    public boolean hasSaferWindow() {
        return saferWindowStart != null && saferWindowEnd != null;
    }
}
