package com.hondigagae.domainlayer.plan.application.port.out.query;

import java.time.LocalDateTime;
import java.time.LocalTime;
import lombok.Builder;

/**
 * tour-service 가 산출한 산책 위험도.
 *
 * <p>적합도와 같다 — 이 서비스는 <b>다시 계산하지 않고</b> 받아서 옮기기만 한다. 등급 임계를
 * 복제하면 같은 시각을 장소 화면은 주의로, 일정 화면은 안전으로 말하게 된다.
 */
@Builder
public record PlaceWalkSafetyQueryResult(
    long placeId,
    String placeTitle,
    LocalDateTime targetDateTime,
    String levelCode,
    String levelName,
    String levelDescription,
    // 추정 노면(아스팔트) 온도. 실측이 아니라 tour-service 의 추정치다 — 화면은 기온과 나란히 둔다.
    Double estimatedPavementCelsius,
    Double feelsLikeCelsius,
    Double temperature,
    LocalTime saferWindowStart,
    LocalTime saferWindowEnd,
    boolean petConditionApplied
) {
}
