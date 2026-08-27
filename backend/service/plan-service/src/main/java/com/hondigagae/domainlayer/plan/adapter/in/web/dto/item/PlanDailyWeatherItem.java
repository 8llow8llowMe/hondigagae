package com.hondigagae.domainlayer.plan.adapter.in.web.dto.item;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import lombok.Builder;

@Builder
@Schema(description = "일정 일자별 날씨 요약 DTO")
public record PlanDailyWeatherItem(

    @Schema(description = "예보 대상 일자", example = "2026-09-13")
    LocalDate date,

    @Schema(description = "최저기온(섭씨)", example = "22.0")
    Double minTemperature,

    @Schema(description = "최고기온(섭씨)", example = "28.0")
    Double maxTemperature,

    @Schema(description = "최대 강수확률(%)", example = "80")
    Integer maxPrecipitationProbability,

    @Schema(description = "그날 가장 나쁜 강수형태", example = "비")
    String precipitationTypeName,

    @Schema(description = "대표 하늘상태", example = "흐림")
    String skyStateName,

    @Schema(description = "최대 풍속(m/s)", example = "5.0")
    Double maxWindSpeed,

    @Schema(description = "최고 습도(%)", example = "88")
    Integer maxHumidity
) {
}
