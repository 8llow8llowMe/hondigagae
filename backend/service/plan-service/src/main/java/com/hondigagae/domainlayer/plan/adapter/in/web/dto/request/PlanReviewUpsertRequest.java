package com.hondigagae.domainlayer.plan.adapter.in.web.dto.request;

import com.hondigagae.domainlayer.plan.application.command.PlanReviewCommand;
import com.hondigagae.domainlayer.plan.application.exception.PlanValidationMessage;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 여행 후기 작성·수정 요청. 일정당 하나라 POST 와 PUT 이 같은 바디다.
 * {@code items} 가 빈 목록이면 전체 만족도만 남긴다. PUT 에서는 이 목록이 전량 교체다.
 */
@Schema(description = "여행 후기 작성·수정 요청 DTO")
public record PlanReviewUpsertRequest(

    @Schema(description = "전체 만족도 (1~5)", example = "4", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = PlanValidationMessage.REVIEW_OVERALL_RATING_REQUIRED)
    @Min(value = 1, message = PlanValidationMessage.REVIEW_OVERALL_RATING_RANGE_INVALID)
    @Max(value = 5, message = PlanValidationMessage.REVIEW_OVERALL_RATING_RANGE_INVALID)
    Integer overallRating,

    @Schema(description = "생략 가능. 후기 본문(2000자 이하)", example = "둘째 날이 더위가 심해서 실내 위주로 다녔어요.")
    @Size(max = 2000, message = PlanValidationMessage.REVIEW_BODY_LENGTH_INVALID)
    String body,

    @Schema(description = "방문 장소별 평가 (최대 50개). 빈 목록이면 전체 만족도만 저장합니다",
        requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = PlanValidationMessage.REVIEW_ITEMS_REQUIRED)
    @Size(max = 50, message = PlanValidationMessage.REVIEW_ITEMS_SIZE_INVALID)
    @Valid
    List<PlanReviewItemRequest> items
) {

    public PlanReviewCommand toCommand() {
        return PlanReviewCommand.builder()
            .overallRating(overallRating)
            .body(body)
            .items(items.stream().map(PlanReviewItemRequest::toCommand).toList())
            .build();
    }
}
