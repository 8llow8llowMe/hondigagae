package com.hondigagae.domainlayer.plan.adapter.in.web.dto.request;

import com.hondigagae.domainlayer.plan.application.exception.PlanValidationMessage;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

@Schema(description = "여행 준비물 챙김 체크 요청 DTO")
public record PlanPackingItemCheckedRequest(

    @Schema(description = "챙김 여부. true = 챙김, false = 체크 해제", example = "true", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = PlanValidationMessage.PACKING_CHECKED_REQUIRED)
    Boolean checked
) {

}
