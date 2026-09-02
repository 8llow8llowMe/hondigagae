package com.hondigagae.domainlayer.insight.adapter.in.web.dto.response;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import com.hondigagae.domainlayer.insight.adapter.in.web.dto.item.RegionWeatherItem;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.util.List;
import lombok.Builder;

/**
 * 제주 권역 날씨 비교 응답.
 *
 * <p><b>{@code recommendedRegion} 이 null 일 수 있다.</b> 어느 권역도 예보를 받지 못하면
 * 고르지 않는다 - "그나마 나은 곳"을 억지로 지목하면 근거 없는 추천이 된다.
 */
@Builder
@Schema(description = "제주 권역 날씨 비교 응답 DTO")
public record RegionalWeatherResponse(

    @Schema(description = "비교 기준 일자", example = "2026-09-02")
    LocalDate date,

    @Schema(description = "권역별 날씨. 예보를 못 받은 권역도 점수 없이 남는다")
    List<RegionWeatherItem> regions,

    @Schema(description = "가장 나가기 좋은 권역 metadata. 판정할 수 있는 권역이 없으면 null", nullable = true)
    CodeNameDescriptionMetadata recommendedRegion,

    @Schema(
        description = "추천 이유. 그 권역의 판정 근거를 그대로 옮긴다 — 데이터 사실만 담는다",
        example = "[\"강수확률 10%로 야외 일정에 무리가 없습니다.\"]")
    List<String> recommendationReasons
) {
}
