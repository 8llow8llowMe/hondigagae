package com.hondigagae.domainlayer.plan.application.port.out.query;

import java.time.LocalDateTime;
import lombok.Builder;

/**
 * 오늘의 산책 골든타임 요약. 원천은 tour-service 의 {@code GET /api/v1/insights/walk-times} 다.
 *
 * <p><b>시간대별 안전 등급 곡선(hourly)은 받지 않는다.</b> 여행 브리핑은 "그날 하나" 를 묶는
 * 요약이라 곡선을 실으면 응답이 몇 배로 커지고, 곡선이 필요한 화면은 좌표를 이미 알고 있으므로
 * 프론트가 tour 의 {@code GET /api/v1/insights/walk-times?lat=&lng=} 를 직접 부른다.
 * 여기서 중계하면 같은 데이터가 두 경로로 흐르면서 tour 스키마 변화가 이쪽까지 흔든다.
 *
 * <p>walk-times 응답의 {@code weatherWarning} 도 무시한다. 특보는
 * {@link com.hondigagae.domainlayer.plan.application.port.out.WeatherWarningQueryPort} 전용
 * 경로로 받는다 — 골든타임 조회가 실패해도 특보는 붙어야 하고, 두 곳에서 받으면 서로 다른
 * 특보가 한 응답에 들어갈 수 있다.
 *
 * <p><b>점수·등급을 재계산하지 않는다.</b> 판정 규칙의 소유자는 tour-service 다.
 *
 * @param goldenStart 추천 구간 시작. 추천할 구간이 없으면 null — <b>이유는
 *                    {@code goldenWindowStatusCode} 로 갈린다</b>
 */
@Builder
public record WalkTimesQueryResult(
    LocalDateTime from,
    String forecastCoverageCode,
    String forecastCoverageName,
    String forecastCoverageDescription,
    LocalDateTime goldenStart,
    LocalDateTime goldenEnd,
    String goldenLevelCode,
    String goldenLevelName,
    String goldenLevelDescription,
    String goldenLevelScoreDescription,
    String goldenWindowStatusCode,
    String goldenWindowStatusName,
    String goldenWindowStatusDescription,
    boolean petConditionApplied
) {

}
