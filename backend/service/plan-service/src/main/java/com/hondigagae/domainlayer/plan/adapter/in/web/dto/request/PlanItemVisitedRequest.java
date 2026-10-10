package com.hondigagae.domainlayer.plan.adapter.in.web.dto.request;

import com.hondigagae.domainlayer.plan.application.exception.PlanValidationMessage;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

@Schema(description = "일정 항목 방문 체크 요청 DTO")
public record PlanItemVisitedRequest(

    @Schema(description = "방문 여부. true = 다녀옴, false = 체크 해제", example = "true", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = PlanValidationMessage.VISITED_REQUIRED)
    Boolean visited
) {

}
