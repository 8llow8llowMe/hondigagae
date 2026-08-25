package com.hondigagae.domainlayer.plan.adapter.in.web.dto.request;

import com.hondigagae.domainlayer.plan.application.command.PlanItemCommand;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import java.util.List;

/**
 * 특정 일차의 항목을 일괄 교체하는 요청. 빈 목록을 보내면 해당 일차 항목이 모두 삭제된다.
 * 항목의 {@code day}는 경로 변수 값으로 덮어쓰므로 본문에 넣지 않아도 된다.
 */
@Schema(description = "일자별 일정 항목 일괄 교체 요청 DTO")
public record PlanDayItemsReplaceRequest(

    @Schema(description = "해당 일차의 항목 목록")
    @Valid
    List<PlanItemRequest> items
) {

    public List<PlanItemCommand> toCommands() {
        return items == null ? List.of()
            : items.stream().map(PlanItemRequest::toCommand).toList();
    }
}
