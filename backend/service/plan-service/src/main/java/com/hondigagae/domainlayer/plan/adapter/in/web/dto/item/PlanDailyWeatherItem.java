package com.hondigagae.domainlayer.plan.adapter.in.web.dto.item;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import lombok.Builder;

@Builder
@Schema(description = "일정 일자별 날씨 요약 DTO")
public record PlanDailyWeatherItem(

    @Schema(description = "예보 대상 일자", example = "2026-09-13")
    LocalDate date,

    @Schema(description = "예보 출처 코드. MID_TERM 이면 대략적인 값이다", example = "SHORT_TERM")
    String forecastSourceCode,

    @Schema(description = "예보 출처 이름", example = "단기예보")
    String forecastSourceName,

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
    Integer maxHumidity,

    @Schema(
        description = "하루 최고 체감온도(섭씨). 시각별 기온과 상대습도로 계산한 열지수(Rothfusz 회귀식 섭씨판)의 "
            + "하루 최대값이라 maxTemperature 와 다른 시각에서 나올 수 있다. 기온 26도 미만이거나 습도가 없는 "
            + "시각은 기온 그대로다. 중기예보(forecastSourceCode=MID_TERM)는 시각별 데이터가 없어 null 이며, "
            + "그때는 maxTemperature 를 대신 표시하고 값을 지어내지 않는다",
        example = "33.4", nullable = true)
    Double maxFeelsLikeTemperature
) {
}
