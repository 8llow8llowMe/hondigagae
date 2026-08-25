package com.hondigagae.domainlayer.plan.adapter.in.web.dto.item;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import lombok.Builder;

@Builder
@Schema(description = "여행 일정 목록 항목 DTO")
public record PlanSummaryItem(

    @Schema(description = "일정 아이디", example = "1234567890123456789")
    String planId,

    @Schema(description = "대상 반려견 아이디", example = "1234567890123456789")
    String petId,

    @Schema(description = "지역 코드", example = "39")
    String areaCode,

    @Schema(description = "일정 제목", example = "몽실이와 제주 2박 3일")
    String title,

    @Schema(description = "여행 시작일", example = "2026-09-12")
    LocalDate startDate,

    @Schema(description = "여행 종료일", example = "2026-09-14")
    LocalDate endDate,

    @Schema(description = "일정 상태", example = "{\"code\":\"DRAFT\",\"name\":\"초안\",\"description\":\"AI 또는 사용자가 작성 중인 일정입니다.\"}")
    CodeNameDescriptionMetadata status
) {
}
