package com.hondigagae.domainlayer.plan.adapter.in.web.dto.item;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

@Builder
@Schema(description = "여행 후기 방문 장소 평가 DTO")
public record PlanReviewPlaceItem(

    @Schema(description = "후기 장소 평가 아이디", example = "1234567890123456791")
    String reviewItemId,

    @Schema(description = "당시 일정 항목 아이디. 일차를 교체해 항목이 사라져도 후기가 기억합니다",
        example = "1234567890123456790")
    String planItemId,

    @Schema(description = "작성 시점의 장소 아이디. 대상 없는 항목이면 null 입니다",
        example = "212481712381923328", nullable = true)
    String placeId,

    @Schema(description = "작성 시점의 일정 항목 이름", example = "천지연폭포")
    String title,

    @Schema(description = "장소 만족도 (1~5)", example = "5")
    int rating,

    @Schema(description = "장소 한 줄 후기. 없으면 null 입니다", example = "그늘이 많아 더위에 약한 아이도 괜찮았어요.",
        nullable = true)
    String comment
) {
}
