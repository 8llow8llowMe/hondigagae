package com.hondigagae.domainlayer.planner.adapter.in.web.dto.item;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

@Builder
@Schema(description = "AI 일정 초안의 개별 일정 항목 DTO")
public record AiPlanScheduleItem(

    @Schema(description = "일정 항목 종류 코드 (PLACE/MEAL/LODGING/WALK/MOVE)", example = "WALK")
    String itemType,

    @Schema(
        description = "장소 아이디. plan-service 에 저장할 때 targetId 로 쓴다. "
            + "이동 항목이거나 검증된 장소가 아니면 null 이다",
        example = "212481712381923328", nullable = true)
    String placeId,

    @Schema(description = "항목 이름", example = "해안 산책로 산책")
    String title,

    @Schema(description = "참고 메모", example = "목줄 착용 필수")
    String note
) {

}
