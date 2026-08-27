package com.hondigagae.domainlayer.insight.adapter.in.web.dto.item;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

/**
 * XAI 추천 이유 한 줄 (api-design-guide §9).
 *
 * <p>{@code description} 에 실제 수치가 들어가는 것이 규약의 요점이다. "날씨가 좋습니다"가
 * 아니라 "최고기온 24도, 강수확률 10%" 여야 근거가 된다.
 */
@Builder
@Schema(description = "적합도 판정 근거 DTO")
public record SuitabilityReasonItem(

    @Schema(description = "근거 코드", example = "HEAT_RISK")
    String code,

    @Schema(description = "근거 이름", example = "고온 주의")
    String name,

    @Schema(description = "데이터 근거를 담은 설명 문장", example = "최고기온 31도 로, 더위에 약한 아이에게는 부담이 큽니다.")
    String description,

    @Schema(description = "이 근거가 점수에 미친 영향. 감점이면 음수, 정보성이면 0", example = "-27")
    int scoreDelta
) {
}
