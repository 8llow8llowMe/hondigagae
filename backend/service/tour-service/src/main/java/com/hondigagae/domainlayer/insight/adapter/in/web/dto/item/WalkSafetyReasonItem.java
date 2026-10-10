package com.hondigagae.domainlayer.insight.adapter.in.web.dto.item;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

@Builder
@Schema(description = "산책 위험도 판정 근거 DTO")
public record WalkSafetyReasonItem(

    @Schema(description = "근거 코드", example = "PAVEMENT_HEAT")
    String code,

    @Schema(description = "근거 이름", example = "노면 고온")
    String name,

    @Schema(
        description = "추정 수치를 담은 설명 문장",
        example = "기온 31도에 일사가 더해져 아스팔트 표면은 약 58도로 추정됩니다. 발바닥 화상 위험 구간입니다.")
    String description
) {
}
