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

    @Schema(description = "최대 풍속(m/s)", example = "4.2")
    Double maxWindSpeed,

    @Schema(description = "최고 습도(%)", example = "85")
    Integer maxHumidity,

    @Schema(description = "예보 강수량 합계(mm). 범위 표기는 하한을 더한 값이다", example = "12.5")
    double totalPrecipitationMm
) {
}
