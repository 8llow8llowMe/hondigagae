package com.hondigagae.domainlayer.insight.adapter.in.web.dto.item;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import lombok.Builder;

/**
 * 하루치 날씨 요약.
 *
 * <p>수치가 전부 Wrapper 인 것은 실제로 없을 수 있어서다. 기상청 예보에 특정 category 가
 * 빠진 시각이 있고, 0 과 값 없음은 다르다.
 */
@Builder
@Schema(description = "일자별 날씨 요약 DTO")
public record DailyWeatherItem(

    @Schema(description = "예보 대상 일자", example = "2026-08-27")
    LocalDate date,

    @Schema(
        description = "이 값이 나온 예보의 출처. MID_TERM 이면 오전/오후 단위라 대략적이고 습도·바람이 없다",
        example = "{\"code\":\"SHORT_TERM\",\"name\":\"단기예보\",\"description\":\"오늘부터 약 5일까지의 시간 단위 예보입니다. 가장 정확합니다.\"}")
    CodeNameDescriptionMetadata forecastSource,

    @Schema(description = "최저기온(섭씨)", example = "24.0")
    Double minTemperature,

    @Schema(description = "최고기온(섭씨)", example = "31.0")
    Double maxTemperature,

    @Schema(description = "최대 강수확률(%)", example = "80")
    Integer maxPrecipitationProbability,

    @Schema(description = "그날 가장 나쁜 강수형태 metadata")
    CodeNameDescriptionMetadata precipitationType,

    @Schema(description = "대표 하늘상태 metadata")
    CodeNameDescriptionMetadata skyState,

    @Schema(description = "최대 풍속(m/s). 중기예보에는 없어 null 이다", example = "4.2")
    Double maxWindSpeed,

    @Schema(description = "최고 습도(%). 중기예보에는 없어 null 이다", example = "85")
    Integer maxHumidity,

    @Schema(
        description = "하루 최고 체감온도(섭씨). 시각별 기온과 상대습도로 계산한 기상청 여름철 체감온도(습구온도 Stull 근사식 기반)의 "
            + "하루 최대값이다. 기온 26도 미만이거나 습도가 없는 시각은 기온을 그대로 쓴다. "
            + "중기예보는 시각별 데이터가 없어 null 이다 — 최고기온으로 대신하지 않는다",
        example = "33.4", nullable = true)
    Double maxFeelsLikeTemperature,

    @Schema(description = "예보 강수량 합계(mm). 범위 표기는 하한을 더한 값이다", example = "12.5")
    double totalPrecipitationMm
) {
}
