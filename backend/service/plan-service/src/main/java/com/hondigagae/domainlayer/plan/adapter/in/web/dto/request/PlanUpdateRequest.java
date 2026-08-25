package com.hondigagae.domainlayer.plan.adapter.in.web.dto.request;

import com.hondigagae.domainlayer.plan.application.command.PlanUpdateCommand;
import com.hondigagae.domainlayer.plan.application.exception.PlanValidationMessage;
import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * 일정 기본 정보 수정 요청. 전달한 필드만 반영하고 null은 기존 값을 유지한다.
 */
@Schema(description = "여행 일정 수정 요청 DTO")
public record PlanUpdateRequest(

    @Schema(description = "일정 제목", example = "몽실이와 제주 2박 3일")
    @Size(max = 60, message = PlanValidationMessage.TITLE_LENGTH_INVALID)
    String title,

    @Schema(description = "여행 시작일", example = "2026-09-12")
    LocalDate startDate,

    @Schema(description = "여행 종료일", example = "2026-09-14")
    LocalDate endDate,

    @Schema(description = "예산 (원)", example = "400000")
    @PositiveOrZero(message = PlanValidationMessage.BUDGET_NEGATIVE_INVALID)
    Integer budget,

    @Schema(description = "일정 상태", example = "CONFIRMED")
    PlanStatus status
) {

    public PlanUpdateCommand toCommand() {
        return PlanUpdateCommand.builder()
            .title(title)
            .startDate(startDate)
            .endDate(endDate)
            .budget(budget)
            .status(status)
            .build();
    }
}
