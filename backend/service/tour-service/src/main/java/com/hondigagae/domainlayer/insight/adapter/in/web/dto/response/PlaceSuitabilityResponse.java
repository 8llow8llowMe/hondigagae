package com.hondigagae.domainlayer.insight.adapter.in.web.dto.response;

import com.hondigagae.common.dto.metadata.ScoreMetricMetadata;
import com.hondigagae.domainlayer.insight.adapter.in.web.dto.item.AlternativePlaceItem;
import com.hondigagae.domainlayer.insight.adapter.in.web.dto.item.CongestionItem;
import com.hondigagae.domainlayer.insight.adapter.in.web.dto.item.DailyWeatherItem;
import com.hondigagae.domainlayer.insight.adapter.in.web.dto.item.SuitabilityReasonItem;
import com.hondigagae.domainlayer.insight.adapter.in.web.dto.item.WeatherWarningItem;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.util.List;
import lombok.Builder;

/**
 * 여행 적합도 응답 (api-design-guide §9 의 score + reasons 형태).
 *
 * <p>{@code score} 가 null 일 수 있다는 점이 이 응답의 핵심이다. 예보가 닿지 않는 날짜이거나
 * 날씨를 가져오지 못하면 점수를 만들지 않고 등급을 INSUFFICIENT 로 준다. 화면은 이 경우
 * 점수 자리에 숫자 대신 "판단 근거 부족"을 보여야 한다.
 */
@Builder
@Schema(description = "장소 여행 적합도 응답 DTO")
public record PlaceSuitabilityResponse(

    @Schema(description = "장소 아이디", example = "212481712381923328")
    String placeId,

    @Schema(description = "장소명", example = "천지연폭포")
    String placeTitle,

    @Schema(description = "판정 기준 일자", example = "2026-08-27")
    LocalDate targetDate,

    @Schema(
        description = "적합도 점수(0~100). 판단 근거가 없으면 null 이며, 이는 0점이 아니라 점수를 내지 않았다는 뜻이다",
        example = "82")
    Integer score,

    @Schema(description = "적합도 등급 metadata")
    ScoreMetricMetadata suitabilityLevel,

    @Schema(description = "판정 근거. 점수 영향이 큰 순서다")
    List<SuitabilityReasonItem> reasons,

    @Schema(description = "근거로 쓴 그날의 날씨. 예보 범위 밖이면 null")
    DailyWeatherItem weather,

    @Schema(description = "근거로 쓴 혼잡도 예측")
    CongestionItem congestion,

    @Schema(description = "비 예보일 때만 채워지는 실내 대안 장소. 비가 안 오면 빈 배열")
    List<AlternativePlaceItem> indoorAlternatives,

    @Schema(description = "요청에 반려견 조건이 포함되어 판정에 반영됐는지", example = "true")
    boolean petConditionApplied,

    @Schema(description = "날씨를 근거로 썼는지", example = "true")
    boolean weatherApplied,

    @Schema(description = "혼잡도를 근거로 썼는지. false 면 그 장소에 연결된 예측 데이터가 없다", example = "false")
    boolean congestionApplied,

    @Schema(description = "날씨 정보 출처", example = "기상청 단기예보")
    String weatherProviderName,

    @Schema(
        description = "발효 중인 기상특보. 없으면 null 이다. 경보면 점수를 내지 않고(0점) 산책은 위험으로 판정한다",
        nullable = true)
    WeatherWarningItem weatherWarning
) {
}
