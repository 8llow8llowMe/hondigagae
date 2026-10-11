package com.hondigagae.domainlayer.insight.adapter.in.web.dto.response;

import com.hondigagae.domainlayer.insight.adapter.in.web.dto.item.PlaceRecommendationItem;
import com.hondigagae.domainlayer.insight.adapter.in.web.dto.item.WeatherWarningItem;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.util.List;
import lombok.Builder;

/**
 * 장소 추천 응답 (#1368).
 *
 * <p>날씨 출처와 특보는 지역 공통이라 목록 머리에 한 번만 둔다. 추천할 곳이 없으면 {@code items} 는 빈 배열이다.
 */
@Builder
@Schema(description = "장소 추천 응답 DTO")
public record PlaceRecommendationResponse(

    @Schema(description = "판정 기준 일자", example = "2026-10-11")
    LocalDate targetDate,

    @Schema(description = "날씨 정보 출처", example = "기상청 단기예보")
    String weatherProviderName,

    @Schema(
        description = "발효 중인 기상특보. 기준 일자가 오늘일 때만 붙고, 없으면 null 이다. 경보면 각 장소 점수가 0 이 된다",
        nullable = true)
    WeatherWarningItem weatherWarning,

    @Schema(description = "추천 장소. 점수 높은 순이며, 추천할 곳이 없으면 빈 배열")
    List<PlaceRecommendationItem> items
) {
}
