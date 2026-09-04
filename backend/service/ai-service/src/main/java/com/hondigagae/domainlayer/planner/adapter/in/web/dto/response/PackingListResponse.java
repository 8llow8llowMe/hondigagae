package com.hondigagae.domainlayer.planner.adapter.in.web.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import lombok.Builder;

@Builder
@Schema(description = "반려견 여행 준비물 목록 응답 DTO")
public record PackingListResponse(

    @Schema(description = "기준 일정 아이디. 요청 경로의 planId 를 문자열로 돌려준다", example = "1234567890123456789")
    String planId,

    @Schema(description = "준비물 목록 (분류별). 항목마다 이 여행 데이터 기반의 이유가 붙는다")
    List<PackingListItem> items,

    @Schema(description = "준비물 수 (items 길이)", example = "11")
    int totalCount
) {

    @Builder
    @Schema(description = "준비물 항목 DTO")
    public record PackingListItem(

        @Schema(description = "분류 (필수/날씨 대비/반려견 케어/이동)", example = "날씨 대비")
        String category,

        @Schema(description = "준비물 이름", example = "휴대용 우비")
        String name,

        @Schema(description = "필요한 이유 — 이 여행의 예보·반려견 특성·일정에 근거한다",
            example = "2일차 강수확률 80% 예보라 야외 일정 중 비를 만날 수 있습니다.")
        String reason
    ) {

    }
}
