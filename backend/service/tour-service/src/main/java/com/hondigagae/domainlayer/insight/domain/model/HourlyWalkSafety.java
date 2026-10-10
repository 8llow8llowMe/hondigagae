package com.hondigagae.domainlayer.insight.domain.model;

import com.hondigagae.shared.travel.insight.WalkSafetyLevel;
import java.time.LocalDateTime;

/**
 * 한 시각의 산책 안전 등급과 그 근거 수치.
 *
 * <p>등급만 주면 화면이 색깔 막대는 그릴 수 있어도 <b>왜 그 색인지</b>는 말하지 못한다.
 * 기온과 추정 노면온도를 함께 담아 사용자가 판단을 검증할 수 있게 한다 (api-design-guide §9).
 */
public record HourlyWalkSafety(
    LocalDateTime at,
    WalkSafetyLevel level,
    double temperature,
    double estimatedPavementCelsius,
    // 원천에 없는 시각이 있어 null 이 정상값이다.
    Integer precipitationProbability
) {

    public boolean isAcceptable() {
        return level == WalkSafetyLevel.SAFE || level == WalkSafetyLevel.CAUTION;
    }
}
