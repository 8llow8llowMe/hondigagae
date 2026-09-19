package com.hondigagae.domainlayer.plan.adapter.in.web.dto.item;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import com.hondigagae.common.dto.metadata.ScoreMetricMetadata;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;
import lombok.Builder;

/**
 * 브리핑에 붙는 오늘의 산책 골든타임. tour-service 판정을 그대로 중계한다.
 *
 * <p><b>시간대별 곡선은 담지 않는다.</b> 브리핑은 "그날 하나" 를 묶는 요약이라 곡선을 실으면
 * 응답이 몇 배로 커진다. 곡선이 필요하면 여기 실린 좌표로 tour 를 직접 부른다 —
 * {@code GET /api/v1/insights/walk-times?lat=&lng=}.
 */
@Builder
@Schema(description = "브리핑 산책 골든타임 DTO")
public record PlanBriefingWalkTimesItem(

    @Schema(description = "판정 기준 좌표 위도 — 그날 대표 장소의 좌표. schedule.representativeLat 과 같은 값이다 — "
        + "골든타임이 null 인 날에도 좌표가 필요해 schedule 에도 싣는다", example = "33.394162")
    double lat,

    @Schema(description = "판정 기준 좌표 경도", example = "126.239831")
    double lng,

    @Schema(description = "판정 기준 시각. 이 시각 이후만 본다", example = "2026-09-10T13:20:00")
    LocalDateTime from,

    @Schema(description = "곡선이 빈 이유 metadata — `AVAILABLE`(판정 가능) / "
        + "`DAY_ENDED`(오늘 예보 시간대가 지남 — 정상, 자정 이후 다시 채워진다) / "
        + "`UNAVAILABLE`(날씨를 가져오지 못함 — 재시도할 일이다)")
    CodeNameDescriptionMetadata forecastCoverage,

    @Schema(description = "골든타임 시작. 추천할 구간이 없으면 null", example = "2026-09-10T18:00:00", nullable = true)
    LocalDateTime goldenStart,

    @Schema(description = "골든타임 종료. 추천할 구간이 없으면 null", example = "2026-09-10T21:00:00", nullable = true)
    LocalDateTime goldenEnd,

    @Schema(description = "골든타임의 안전 등급 metadata. 추천할 구간이 없으면 null", nullable = true)
    ScoreMetricMetadata goldenLevel,

    @Schema(description = "골든타임을 준 이유/안 준 이유 metadata — `AVAILABLE`(구간 있음) / "
        + "`SUPPRESSED_BY_WARNING`(특보 경보로 보류 — **곡선에 안전 시각이 남아 있어도 이 값이다**) / "
        + "`ALL_HOURS_RISKY`(남은 시각이 전부 위험) / `NO_FORECAST`(판정할 예보 없음). "
        + "**`goldenStart` 가 null 이라는 이유만으로 '남은 시간이 모두 위험'이라고 쓰지 마세요** — "
        + "그 문구는 `ALL_HOURS_RISKY` 일 때만 참입니다. "
        + "시간대별 곡선이 필요하면 위 좌표로 `GET /api/v1/insights/walk-times?lat=&lng=` 를 직접 부르세요")
    CodeNameDescriptionMetadata goldenWindowStatus,

    @Schema(description = "판정에 반려견 조건(기준 반려견)이 반영됐는지", example = "true")
    boolean petConditionApplied
) {
}
