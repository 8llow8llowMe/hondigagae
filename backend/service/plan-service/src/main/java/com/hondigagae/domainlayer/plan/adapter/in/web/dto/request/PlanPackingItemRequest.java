package com.hondigagae.domainlayer.plan.adapter.in.web.dto.request;

import com.hondigagae.domainlayer.plan.application.command.PlanPackingItemCommand;
import com.hondigagae.domainlayer.plan.application.exception.PlanValidationMessage;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "여행 준비물 항목 요청 DTO")
public record PlanPackingItemRequest(

    @Schema(description = "준비물 분류 (30자 이하). AI 가 내는 값을 그대로 보냅니다", example = "반려견 케어",
        requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = PlanValidationMessage.PACKING_CATEGORY_REQUIRED)
    @Size(max = 30, message = PlanValidationMessage.PACKING_CATEGORY_LENGTH_INVALID)
    String category,

    @Schema(description = "준비물 이름 (100자 이하). 같은 이름이 두 번 오면 첫 것만 저장됩니다 "
        + "(대소문자와 앞뒤 공백은 구분하지 않습니다)", example = "리드줄",
        requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = PlanValidationMessage.PACKING_NAME_REQUIRED)
    @Size(max = 100, message = PlanValidationMessage.PACKING_NAME_LENGTH_INVALID)
    String name,

    @Schema(description = "생략 가능. 이 여행 데이터를 근거로 한 준비 이유 (500자 이하)",
        example = "숲길 코스가 이틀 들어 있어 목줄 착용 구간이 깁니다.")
    @Size(max = 500, message = PlanValidationMessage.PACKING_REASON_LENGTH_INVALID)
    String reason
) {

    public PlanPackingItemCommand toCommand() {
        return PlanPackingItemCommand.builder()
            .category(category)
            .name(name)
            .reason(reason)
            .build();
    }
}
