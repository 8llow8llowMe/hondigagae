package com.hondigagae.domainlayer.insight.adapter.in.web.dto.response;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import com.hondigagae.common.dto.metadata.ScoreMetricMetadata;
import com.hondigagae.domainlayer.insight.adapter.in.web.dto.item.WalkSafetyReasonItem;
import com.hondigagae.domainlayer.insight.adapter.in.web.dto.item.WeatherWarningItem;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import lombok.Builder;

/**
 * 산책 위험도 응답.
 *
 * <p>추정 노면온도를 값으로 내리는 것이 이 응답의 요점이다. "위험합니다"만 주면 사용자는
 * 근거를 확인할 수 없고, 기온 31도라는 익숙한 숫자와 아스팔트 58도라는 숫자를 나란히 봐야
 * 왜 위험한지가 전달된다.
 *
 * <p>{@code saferWindowStart/End} 는 조언의 실체다. 같은 날 더 나은 시간대를 함께 주지 않으면
 * 사용자가 할 수 있는 일이 없다.
 */
@Builder
@Schema(description = "장소 산책 위험도 응답 DTO")
public record WalkSafetyResponse(

    @Schema(description = "장소 아이디", example = "212481712381923328")
    String placeId,

    @Schema(description = "장소명", example = "협재해수욕장")
    String placeTitle,

    @Schema(description = "판정 기준 시각", example = "2026-08-27T14:00:00")
    LocalDateTime targetDateTime,

    @Schema(description = "산책 위험도 등급 metadata")
    ScoreMetricMetadata walkSafetyLevel,

    @Schema(description = "판정 근거")
    List<WalkSafetyReasonItem> reasons,

    @Schema(
        description = "추정 아스팔트 표면온도(섭씨). 실측이 아니라 기온/하늘상태/시간대로 계산한 추정치다",
        example = "58.0")
    Double estimatedPavementCelsius,

    @Schema(description = "기온과 습도를 합친 체감 열지수(섭씨)", example = "35.0")
    Double heatIndexCelsius,

    @Schema(description = "같은 날 더 안전한 시간대 시작. 없으면 null", example = "18:00:00")
    LocalTime saferWindowStart,

    @Schema(description = "같은 날 더 안전한 시간대 종료. 없으면 null", example = "21:00:00")
    LocalTime saferWindowEnd,

    @Schema(description = "판정에 쓴 기온(섭씨)", example = "31.0")
    Double temperature,

    @Schema(description = "판정에 쓴 습도(%)", example = "78")
    Integer humidity,

    @Schema(description = "판정에 쓴 하늘상태 metadata")
    CodeNameDescriptionMetadata skyState,

    @Schema(description = "판정에 쓴 강수형태 metadata")
    CodeNameDescriptionMetadata precipitationType,

    @Schema(description = "요청에 반려견 조건이 포함되어 판정에 반영됐는지", example = "true")
    boolean petConditionApplied,

    @Schema(description = "날씨 정보 출처", example = "기상청 단기예보")
    String weatherProviderName,

    @Schema(
        description = "발효 중인 기상특보. 없으면 null 이다. 경보면 점수를 내지 않고(0점) 산책은 위험으로 판정한다",
        nullable = true)
    WeatherWarningItem weatherWarning
) {
}
