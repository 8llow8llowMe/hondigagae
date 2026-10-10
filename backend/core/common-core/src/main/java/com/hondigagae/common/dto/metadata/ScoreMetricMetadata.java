package com.hondigagae.common.dto.metadata;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

@Builder
@Schema(description = "점수 지표 메타데이터 DTO")
public record ScoreMetricMetadata(

    @Schema(description = "내부 코드 값", example = "OPPORTUNITY_SCORE")
    String code,

    @Schema(description = "화면 표시 이름", example = "기회도")
    String name,

    @Schema(description = "지표 설명")
    String description,

    @Schema(description = "점수 해석 설명")
    String scoreDescription
) {

    public static ScoreMetricMetadata of(String code, String name, String description, String scoreDescription) {
        return ScoreMetricMetadata.builder()
            .code(code)
            .name(name)
            .description(description)
            .scoreDescription(scoreDescription)
            .build();
    }
}
