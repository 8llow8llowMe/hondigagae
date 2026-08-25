package com.hondigagae.domainlayer.planner.adapter.in.web.dto.item;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import lombok.Builder;

@Builder
@Schema(description = "AI 일정 초안의 일자 단위 항목 DTO")
public record AiPlanDayItem(

    @Schema(description = "여행 일차 (1부터 시작)", example = "1")
    int day,

    @Schema(description = "해당 일차의 일정 항목 목록")
    List<AiPlanScheduleItem> items
) {

}
