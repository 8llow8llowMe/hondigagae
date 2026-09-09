package com.hondigagae.domainlayer.insight.adapter.in.web.dto.item;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import lombok.Builder;

/**
 * 한 권역의 날씨와 점수.
 *
 * <p>예보를 못 받은 권역도 <b>목록에 남는다.</b> 그때 {@code weatherScore} 가 null 이고
 * {@code reasons} 에 그 사실이 담긴다 - 목록에서 지우면 사용자는 그 권역이 조회되지 않았다는
 * 것조차 모른 채 "비교 대상이 넷"이라고 읽는다.
 */
@Builder
@Schema(description = "권역별 날씨 비교 항목 DTO")
public record RegionWeatherItem(

    @Schema(description = "권역 metadata")
    CodeNameDescriptionMetadata region,

    @Schema(description = "날씨만으로 매긴 점수(0~100). null 이면 예보를 못 받아 판정하지 않았다", example = "82")
    Integer weatherScore,

    @Schema(description = "하늘상태 metadata. 예보가 없으면 null")
    CodeNameDescriptionMetadata skyState,

    @Schema(description = "강수형태 metadata. 예보가 없으면 null")
    CodeNameDescriptionMetadata precipitationType,

    @Schema(description = "최고 강수확률(%)", example = "20")
    Integer maxPrecipitationProbability,

    @Schema(description = "최저기온(℃)", example = "18.0")
    Double minTemperature,

    @Schema(description = "최고기온(℃)", example = "26.0")
    Double maxTemperature,

    @Schema(
        description = "하루 최고 체감온도(섭씨). 시각별 기온·상대습도로 계산한 기상청 여름철 체감온도의 "
            + "하루 최대값이며 폭염특보(주의보 33℃·경보 35℃)와 같은 척도다. 장소 상세의 "
            + "`weather.maxFeelsLikeTemperature` 와 같은 규칙이라 두 화면의 숫자가 어긋나지 않는다. "
            + "예보가 없으면 null 이다 — 최고기온으로 대신하지 않는다",
        example = "33.4", nullable = true)
    Double maxFeelsLikeTemperature,

    @Schema(description = "최대 풍속(m/s). 중기예보 기반 날짜는 null", example = "5.2")
    Double maxWindSpeed,

    @Schema(description = "판정 근거. 데이터 사실만 담는다 (api-design-guide §9)")
    List<SuitabilityReasonItem> reasons
) {
}
