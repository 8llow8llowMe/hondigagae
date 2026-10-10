package com.hondigagae.domainlayer.plan.adapter.in.web.dto.item;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalTime;
import lombok.Builder;

@Builder
@Schema(description = "브리핑 일정 항목 요약 DTO")
public record PlanBriefingItemSummaryItem(

    @Schema(description = "일정 항목 아이디", example = "1234567890123456789")
    String planItemId,

    @Schema(description = "그날 안에서의 순서 (0부터)", example = "0")
    int sequence,

    @Schema(description = "항목 유형", example = "{\"code\":\"PLACE\",\"name\":\"장소\",\"description\":\"관광지·카페 등 방문 장소 항목입니다.\"}")
    CodeNameDescriptionMetadata itemType,

    @Schema(description = "항목 제목", example = "협재해수욕장")
    String title,

    @Schema(description = "예정 시각. 지정하지 않은 항목은 null", example = "10:30:00", nullable = true)
    LocalTime startTime,

    @Schema(description = "방문 체크 여부", example = "false")
    boolean visited
) {
}
