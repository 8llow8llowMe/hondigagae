package com.hondigagae.domainlayer.plan.adapter.in.web.dto.request;

import com.hondigagae.domainlayer.plan.application.command.PlanCreateCommand;
import com.hondigagae.domainlayer.plan.application.command.PlanItemCommand;
import com.hondigagae.domainlayer.plan.application.exception.PlanValidationMessage;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;

@Schema(description = "여행 일정 생성 요청 DTO")
public record PlanCreateRequest(

    @Schema(description = "대상 반려견 아이디", example = "1234567890123456789")
    @NotNull(message = PlanValidationMessage.PET_ID_REQUIRED)
    Long petId,

    @Schema(description = "지역 코드 (제주=39)", example = "39")
    @NotBlank(message = PlanValidationMessage.AREA_CODE_REQUIRED)
    String areaCode,

    @Schema(description = "시군구 코드", example = "4")
    String sigunguCode,

    @Schema(description = "일정 제목", example = "몽실이와 제주 2박 3일")
    @NotBlank(message = PlanValidationMessage.TITLE_REQUIRED)
    @Size(max = 60, message = PlanValidationMessage.TITLE_LENGTH_INVALID)
    String title,

    @Schema(description = "여행 시작일", example = "2026-09-12")
    @NotNull(message = PlanValidationMessage.START_DATE_REQUIRED)
    LocalDate startDate,

    @Schema(description = "여행 종료일", example = "2026-09-14")
    @NotNull(message = PlanValidationMessage.END_DATE_REQUIRED)
    LocalDate endDate,

    @Schema(description = "예산 (원)", example = "400000")
    @PositiveOrZero(message = PlanValidationMessage.BUDGET_NEGATIVE_INVALID)
    Integer budget,

    @Schema(description = "일정 항목 목록 (생략 가능)")
    @Valid
    List<PlanItemRequest> items
) {

    public PlanCreateCommand toCommand() {
        List<PlanItemCommand> itemCommands = items == null ? List.of()
            : items.stream().map(PlanItemRequest::toCommand).toList();

        return PlanCreateCommand.builder()
            .petId(petId)
            .areaCode(areaCode)
            .sigunguCode(sigunguCode)
            .title(title)
            .startDate(startDate)
            .endDate(endDate)
            .budget(budget)
            .items(itemCommands)
            .build();
    }
}
