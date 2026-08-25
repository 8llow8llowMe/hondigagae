package com.hondigagae.domainlayer.plan.adapter.in.web.dto.item;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalTime;
import lombok.Builder;

@Builder
@Schema(description = "여행 일정 항목 DTO")
public record PlanItemDetailItem(

    @Schema(description = "일정 항목 아이디", example = "1234567890123456789")
    String planItemId,

    @Schema(description = "일차 (1부터)", example = "1")
    int day,

    @Schema(description = "같은 일차 내 표시 순서", example = "0")
    int sequence,

    @Schema(description = "항목 유형", example = "{\"code\":\"PLACE\",\"name\":\"장소\",\"description\":\"관광지·카페 등 방문 장소 항목입니다.\"}")
    CodeNameDescriptionMetadata itemType,

    @Schema(description = "대상 아이디 (항목 유형에 따라 place.id 또는 walk_course.id)", example = "126439")
    Long targetId,

    @Schema(description = "항목 이름", example = "천지연폭포")
    String title,

    @Schema(description = "메모", example = "그늘이 많아 더위에 약한 아이도 괜찮음")
    String memo,

    @Schema(description = "시작 시각", example = "10:30:00")
    LocalTime startTime
) {
}
