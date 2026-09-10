package com.hondigagae.domainlayer.plan.adapter.in.web.dto.item;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;
import lombok.Builder;

/**
 * 브리핑에 붙는 기상특보. 원천은 tour-service 이고 <b>가장 무거운 한 건</b>만 담는다 —
 * 여러 특보가 동시에 뜨면(태풍 + 호우 + 강풍) 화면이 무엇을 강조해야 할지 알 수 없기 때문이다.
 */
@Builder
@Schema(description = "브리핑 기상특보 DTO")
public record PlanBriefingWeatherWarningItem(

    @Schema(description = "특보 종류 metadata — TYPHOON(태풍) / HEAVY_RAIN(호우) / STRONG_WIND(강풍) / "
        + "HEAT_WAVE(폭염) / COLD_WAVE(한파) / HEAVY_SNOW(대설) / TROPICAL_NIGHT(열대야) / "
        + "WIND_WAVE(풍랑) / DRY(건조) / OTHER(기타 특보)")
    CodeNameDescriptionMetadata type,

    @Schema(description = "특보 단계 metadata — ADVISORY(주의보) / WARNING(경보)")
    CodeNameDescriptionMetadata level,

    @Schema(description = "경보 단계라 야외 일정 추천을 보류해야 하는지. "
        + "**이 값을 쓰고 level.code 로 직접 판정하지 마세요** — 판정 규칙은 tour-service 가 갖습니다",
        example = "true")
    boolean recommendationSuppressed,

    @Schema(description = "발효 시각. 원천이 주지 않으면 null", example = "2026-09-10T06:00:00", nullable = true)
    LocalDateTime effectiveAt
) {
}
