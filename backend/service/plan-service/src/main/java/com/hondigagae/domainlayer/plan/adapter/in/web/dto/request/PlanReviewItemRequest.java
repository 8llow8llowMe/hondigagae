package com.hondigagae.domainlayer.plan.adapter.in.web.dto.request;

import com.hondigagae.domainlayer.plan.application.command.PlanReviewItemCommand;
import com.hondigagae.domainlayer.plan.application.exception.PlanValidationMessage;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

@Schema(description = "여행 후기 방문 장소 평가 요청 DTO")
public record PlanReviewItemRequest(

    @Schema(description = "다녀온 장소 항목 아이디. Snowflake 라 예시 값은 형식 안내용입니다",
        example = "1234567890123456790", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = PlanValidationMessage.REVIEW_ITEM_ID_POSITIVE)
    @Positive(message = PlanValidationMessage.REVIEW_ITEM_ID_POSITIVE)
    Long planItemId,

    @Schema(description = "장소 만족도 (1~5)", example = "5", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = PlanValidationMessage.REVIEW_ITEM_RATING_REQUIRED)
    @Min(value = 1, message = PlanValidationMessage.REVIEW_ITEM_RATING_RANGE_INVALID)
    @Max(value = 5, message = PlanValidationMessage.REVIEW_ITEM_RATING_RANGE_INVALID)
    Integer rating,

    @Schema(description = "생략 가능. 장소 한 줄 후기(200자 이하)", example = "그늘이 많아 더위에 약한 아이도 괜찮았어요.")
    @Size(max = 200, message = PlanValidationMessage.REVIEW_ITEM_COMMENT_LENGTH_INVALID)
    String comment
) {

    public PlanReviewItemCommand toCommand() {
        return PlanReviewItemCommand.builder()
            .planItemId(planItemId)
            .rating(rating)
            .comment(comment)
            .build();
    }
}
