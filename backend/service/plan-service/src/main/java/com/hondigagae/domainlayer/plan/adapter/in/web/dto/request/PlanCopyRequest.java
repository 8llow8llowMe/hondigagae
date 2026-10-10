package com.hondigagae.domainlayer.plan.adapter.in.web.dto.request;

import com.hondigagae.domainlayer.plan.application.command.PlanCopyCommand;
import com.hondigagae.domainlayer.plan.application.exception.PlanValidationMessage;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

@Schema(description = "여행 일정 복제 요청 DTO")
public record PlanCopyRequest(

    @Schema(description = "생략 가능. 새 일정 제목. 생략하면 원본 제목 뒤에 \" (복사)\" 를 붙입니다.", example = "몽실이와 제주 2박 3일 (복사)")
    @Size(max = 60, message = PlanValidationMessage.TITLE_LENGTH_INVALID)
    String title,

    @Schema(description = "새 여행 시작일 (yyyy-MM-dd). 일수는 원본과 같아야 합니다.", example = "2027-09-12",
        requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = PlanValidationMessage.START_DATE_REQUIRED)
    LocalDate startDate,

    @Schema(description = "새 여행 종료일 (yyyy-MM-dd). 시작일과 같거나 이후여야 하고 일수는 원본과 같아야 합니다.", example = "2027-09-14",
        requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = PlanValidationMessage.END_DATE_REQUIRED)
    LocalDate endDate
) {

    public PlanCopyCommand toCommand() {
        return PlanCopyCommand.builder()
            .title(title)
            .startDate(startDate)
            .endDate(endDate)
            .build();
    }
}
