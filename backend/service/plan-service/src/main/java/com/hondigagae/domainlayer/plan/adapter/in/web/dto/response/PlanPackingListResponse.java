package com.hondigagae.domainlayer.plan.adapter.in.web.dto.response;

import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanPackingDetailItem;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;
import java.util.List;
import lombok.Builder;

@Builder
@Schema(description = "여행 준비물 목록 응답 DTO")
public record PlanPackingListResponse(

    @Schema(description = "일정 아이디", example = "1234567890123456789")
    String planId,

    @Schema(description = "준비물 항목 목록 (표시 순서 오름차순)")
    List<PlanPackingDetailItem> items,

    @Schema(description = "전체 항목 수. 자를 일이 없는 전량 조회라 items 의 개수와 같습니다", example = "12")
    int totalCount,

    @Schema(description = "챙김 체크된 항목 수", example = "3")
    int checkedCount,

    @Schema(description = "AI 항목이 마지막으로 저장된 시각. AI 항목이 하나도 없으면 null 입니다",
        example = "2026-09-11T14:02:11", nullable = true)
    LocalDateTime generatedAt
) {
}
