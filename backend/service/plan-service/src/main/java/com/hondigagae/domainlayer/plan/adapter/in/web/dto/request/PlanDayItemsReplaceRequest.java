package com.hondigagae.domainlayer.plan.adapter.in.web.dto.request;

import com.hondigagae.domainlayer.plan.application.command.PlanItemCommand;
import com.hondigagae.domainlayer.plan.application.exception.PlanValidationMessage;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 특정 일차의 항목을 일괄 교체하는 요청. 빈 목록을 보내면 해당 일차 항목이 모두 삭제된다.
 * 항목의 {@code day}는 경로 변수 값으로 덮어쓰므로 본문에 넣지 않아도 된다.
 *
 * <p>{@code @Size} 는 <b>한 날만으로</b> 일정 항목 상한을 넘는 것을 막는다 (#1243). 다른 날 항목에 더해져
 * 넘는 것은 요청 하나로 알 수 없어 서비스가 교체 뒤 일정 전체 수로 본다({@code PLAN_028}).
 */
@Schema(description = "일자별 일정 항목 일괄 교체 요청 DTO")
public record PlanDayItemsReplaceRequest(

    @Schema(description = "생략 가능. 해당 일차의 항목 목록(최대 " + Plan.MAX_ITEMS + "개, 넘으면 PLAN_136). "
        + "생략하거나 빈 목록이면 해당 일차 항목이 모두 삭제됩니다. 교체 뒤 일정 전체 항목이 "
        + Plan.MAX_ITEMS + "개를 넘으면 PLAN_028 입니다.")
    @Valid
    @Size(max = Plan.MAX_ITEMS, message = PlanValidationMessage.ITEMS_SIZE_INVALID)
    List<PlanItemRequest> items
) {

    public List<PlanItemCommand> toCommands() {
        return items == null ? List.of()
            : items.stream().map(PlanItemRequest::toCommand).toList();
    }
}
