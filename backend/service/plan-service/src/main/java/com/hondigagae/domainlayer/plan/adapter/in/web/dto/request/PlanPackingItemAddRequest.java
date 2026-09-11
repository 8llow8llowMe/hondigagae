package com.hondigagae.domainlayer.plan.adapter.in.web.dto.request;

import com.hondigagae.domainlayer.plan.application.command.PlanPackingItemCommand;
import com.hondigagae.domainlayer.plan.application.exception.PlanValidationMessage;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 사용자가 준비물 항목을 직접 추가하는 요청. {@code reason} 을 받지 않는다 —
 * 이유는 이 여행의 일정·날씨를 읽은 AI 만 붙일 수 있고, 사용자 추가 항목에는 채울 근거가 없다.
 */
@Schema(description = "여행 준비물 직접 추가 요청 DTO")
public record PlanPackingItemAddRequest(

    @Schema(description = "준비물 분류 (30자 이하). AI 가 쓰는 분류와 같은 이름을 쓰면 같은 묶음으로 보입니다",
        example = "반려견 케어", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = PlanValidationMessage.PACKING_CATEGORY_REQUIRED)
    @Size(max = 30, message = PlanValidationMessage.PACKING_CATEGORY_LENGTH_INVALID)
    String category,

    @Schema(description = "준비물 이름 (100자 이하). 이미 있는 이름이면 실패합니다", example = "배변봉투",
        requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = PlanValidationMessage.PACKING_NAME_REQUIRED)
    @Size(max = 100, message = PlanValidationMessage.PACKING_NAME_LENGTH_INVALID)
    String name
) {

    public PlanPackingItemCommand toCommand() {
        return PlanPackingItemCommand.builder()
            .category(category)
            .name(name)
            .build();
    }
}
