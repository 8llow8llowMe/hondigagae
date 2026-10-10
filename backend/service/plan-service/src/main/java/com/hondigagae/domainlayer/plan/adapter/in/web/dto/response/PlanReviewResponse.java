package com.hondigagae.domainlayer.plan.adapter.in.web.dto.response;

import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanReviewPlaceItem;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;
import java.util.List;
import lombok.Builder;

@Builder
@Schema(description = "여행 후기 응답 DTO")
public record PlanReviewResponse(

    @Schema(description = "후기 아이디", example = "1234567890123456792")
    String reviewId,

    @Schema(description = "일정 아이디", example = "1234567890123456789")
    String planId,

    @Schema(description = "전체 만족도 (1~5)", example = "4")
    int overallRating,

    @Schema(description = "후기 본문. 없으면 null 입니다", example = "둘째 날이 더위가 심해서 실내 위주로 다녔어요.",
        nullable = true)
    String body,

    @Schema(description = "방문 장소별 평가. 일차를 교체해 사라진 항목도 당시 제목·장소 아이디로 남습니다")
    List<PlanReviewPlaceItem> items,

    @Schema(description = "작성 시각", example = "2026-09-15T11:20:00")
    LocalDateTime createdAt,

    @Schema(description = "수정 시각", example = "2026-09-15T11:25:00")
    LocalDateTime updatedAt
) {
}
