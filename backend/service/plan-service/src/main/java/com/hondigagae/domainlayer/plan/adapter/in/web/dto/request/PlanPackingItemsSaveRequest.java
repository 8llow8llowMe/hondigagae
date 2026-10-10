package com.hondigagae.domainlayer.plan.adapter.in.web.dto.request;

import com.hondigagae.domainlayer.plan.application.command.PlanPackingItemCommand;
import com.hondigagae.domainlayer.plan.application.exception.PlanValidationMessage;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * AI 생성 결과를 저장하는 요청. {@code source = AI} 인 항목만 교체하고 사용자가 직접 추가한 항목은 남는다.
 * 빈 목록을 보내면 AI 항목이 모두 지워진다.
 */
@Schema(description = "여행 준비물 저장 요청 DTO")
public record PlanPackingItemsSaveRequest(

    @Schema(description = "저장할 준비물 항목 목록 (최대 50개). 빈 목록을 보내면 AI 항목이 모두 삭제됩니다",
        requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = PlanValidationMessage.PACKING_ITEMS_REQUIRED)
    @Size(max = 50, message = PlanValidationMessage.PACKING_ITEMS_SIZE_INVALID)
    @Valid
    List<PlanPackingItemRequest> items
) {

    public List<PlanPackingItemCommand> toCommands() {
        return items.stream().map(PlanPackingItemRequest::toCommand).toList();
    }
}
