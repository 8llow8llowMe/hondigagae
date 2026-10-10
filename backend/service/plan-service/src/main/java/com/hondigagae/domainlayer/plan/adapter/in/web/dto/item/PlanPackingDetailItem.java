package com.hondigagae.domainlayer.plan.adapter.in.web.dto.item;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

@Builder
@Schema(description = "여행 준비물 항목 DTO")
public record PlanPackingDetailItem(

    @Schema(description = "준비물 항목 아이디", example = "1234567890123456790")
    String packingItemId,

    @Schema(description = "준비물 분류. 값의 원천이 AI 라 고정 목록이 아니다 — 화면은 받은 문자열을 그대로 묶어 보여 주면 됩니다",
        example = "반려견 케어")
    String category,

    @Schema(description = "준비물 이름", example = "리드줄")
    String name,

    @Schema(description = "이 여행 데이터를 근거로 한 준비 이유. 사용자가 직접 추가한 항목은 null 입니다",
        example = "숲길 코스가 이틀 들어 있어 목줄 착용 구간이 깁니다.", nullable = true)
    String reason,

    @Schema(description = "출처. AI 항목만 재생성 때 교체되고 USER 항목은 남습니다",
        example = "{\"code\":\"AI\",\"name\":\"AI 추천\",\"description\":\"AI 가 이 여행의 일정·날씨·반려견 특성을 근거로 제안한 항목입니다.\"}")
    CodeNameDescriptionMetadata source,

    @Schema(description = "챙김 체크. 재생성해도 같은 이름의 항목에 승계됩니다", example = "false")
    boolean checked,

    @Schema(description = "표시 순서 (0부터)", example = "0")
    int sortOrder
) {
}
