package com.hondigagae.domainlayer.planner.adapter.in.web.dto.request;

import com.hondigagae.domainlayer.planner.application.command.AiPlanCreateCommand;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanValidationMessage;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import lombok.Builder;

@Builder
@Schema(description = "AI 여행 일정 생성 요청 DTO")
public record AiPlanCreateRequest(

    @Schema(description = "여행 지역 코드 (관광 areaCode, 제주=39)", example = "39")
    @NotBlank(message = AiPlanValidationMessage.AREA_CODE_REQUIRED)
    String areaCode,

    @Schema(description = "여행 시작일", example = "2026-09-11")
    @NotNull(message = AiPlanValidationMessage.START_DATE_REQUIRED)
    LocalDate startDate,

    @Schema(description = "여행 종료일", example = "2026-09-13")
    @NotNull(message = AiPlanValidationMessage.END_DATE_REQUIRED)
    LocalDate endDate,

    @Schema(description = "예산 (원 단위, 선택)", example = "400000")
    @Positive(message = AiPlanValidationMessage.BUDGET_POSITIVE)
    Long budget,

    @Schema(description = "동반 반려견 식별자", example = "1234567890123456789")
    @NotNull(message = AiPlanValidationMessage.PET_ID_REQUIRED)
    @Positive(message = AiPlanValidationMessage.PET_ID_POSITIVE)
    Long petId,

    @Schema(description = "요청 메모 (선택) — 자연어 요구사항", example = "산책 위주로, 더위에 약한 아이라 실내 위주로 부탁해요")
    @Size(max = 500, message = AiPlanValidationMessage.REQUEST_NOTE_LENGTH_INVALID)
    String requestNote
) {

    public AiPlanCreateCommand toCommand() {
        return AiPlanCreateCommand.builder()
            .areaCode(areaCode)
            .startDate(startDate)
            .endDate(endDate)
            .budget(budget)
            .petId(petId)
            .requestNote(requestNote)
            .build();
    }
}
