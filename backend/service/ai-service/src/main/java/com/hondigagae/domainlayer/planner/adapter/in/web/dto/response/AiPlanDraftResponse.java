package com.hondigagae.domainlayer.planner.adapter.in.web.dto.response;

import com.hondigagae.domainlayer.planner.adapter.in.web.dto.item.AiPlanDayItem;
import com.hondigagae.domainlayer.planner.adapter.in.web.dto.item.AiPlanReasonItem;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import lombok.Builder;

@Builder
@Schema(description = "AI가 생성한 여행 일정 초안 응답 DTO. 확정 저장은 plan-service API로 수행한다.")
public record AiPlanDraftResponse(

    @Schema(description = "일자별 일정 목록")
    List<AiPlanDayItem> days,

    @Schema(description = "추천 이유 목록 (XAI)")
    List<AiPlanReasonItem> reasons
) {

}
