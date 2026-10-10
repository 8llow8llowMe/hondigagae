package com.hondigagae.domainlayer.insight.adapter.in.web.dto.item;

import com.hondigagae.common.dto.metadata.ScoreMetricMetadata;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;
import lombok.Builder;

/**
 * 한 시각의 산책 안전 등급.
 *
 * <p>등급만 주면 화면이 색깔 막대는 그려도 <b>왜 그 색인지</b>는 말하지 못한다. 기온과
 * 추정 노면(아스팔트) 온도를 함께 담아 사용자가 판단을 검증할 수 있게 한다 (api-design-guide §9).
 *
 * <p><b>둘은 반드시 짝으로 보여야 한다.</b> 노면온도만 두면 사용자는 그것을 기온으로 읽는다 -
 * 실제로 기온 29도인 날 노면 56도만 표시되어 값이 잘못됐다는 신고가 들어왔다. 기온이라는
 * 익숙한 숫자가 옆에 있어야 "기온은 괜찮은데 지면이 뜨겁다"는 이 서비스의 요점이 전달된다.
 */
@Builder
@Schema(description = "시간대별 산책 안전 DTO")
public record HourlyWalkSafetyItem(

    @Schema(description = "예보 시각", example = "2026-09-02T15:00:00")
    LocalDateTime at,

    @Schema(description = "산책 안전 등급 metadata")
    ScoreMetricMetadata walkSafetyLevel,

    @Schema(
        description = "기온(℃). 사람이 보는 그 기온이다. **노면온도와 나란히 보여 주세요** — "
            + "노면온도만 두면 사용자가 그것을 기온으로 읽는다",
        example = "29.0")
    double temperature,

    @Schema(
        description = "추정 노면(아스팔트) 온도(℃). 기온에 일사(날짜·시각·위도로 낸 태양 고도), "
            + "하늘상태, 바람을 반영해 계산한 값이며 실측이 아니다. **화면 문구에 '노면(아스팔트)' 를 밝혀 주세요**",
        example = "44.0")
    double estimatedPavementCelsius,

    @Schema(description = "강수확률(%). 원천에 없는 시각은 null", example = "20", nullable = true)
    Integer precipitationProbability
) {
}
