package com.hondigagae.domainlayer.plan.adapter.in.web.dto.item;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

@Builder
@Schema(description = "일정 날씨 판정 근거 DTO")
public record PlanWeatherReasonItem(

    @Schema(description = "근거 코드", example = "RAIN_EXPECTED")
    String code,

    @Schema(description = "근거 이름", example = "강수 예보")
    String name,

    @Schema(description = "데이터 근거를 담은 설명 문장", example = "강수확률 80% 로 야외 일정에 영향이 있습니다.")
    String description,

    @Schema(description = "점수 영향. 감점이면 음수", example = "-25")
    int scoreDelta
) {
}
