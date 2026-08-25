package com.hondigagae.domainlayer.planner.adapter.in.web.dto.item;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

@Builder
@Schema(description = "AI 추천 이유 항목 DTO (XAI — api-design-guide §9)")
public record AiPlanReasonItem(

    @Schema(description = "이유 코드", example = "PET_ALLOWED")
    String code,

    @Schema(description = "이유 이름", example = "반려견 동반 가능")
    String name,

    @Schema(description = "데이터 근거 설명", example = "추천 장소는 모두 반려견 출입이 가능한 시설로만 구성했습니다.")
    String description
) {

}
