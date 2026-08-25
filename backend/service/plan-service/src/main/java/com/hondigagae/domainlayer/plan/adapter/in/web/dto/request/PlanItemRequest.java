package com.hondigagae.domainlayer.plan.adapter.in.web.dto.request;

import com.hondigagae.domainlayer.plan.application.command.PlanItemCommand;
import com.hondigagae.domainlayer.plan.application.exception.PlanValidationMessage;
import com.hondigagae.domainlayer.plan.domain.enums.PlanItemType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalTime;

@Schema(description = "여행 일정 항목 요청 DTO")
public record PlanItemRequest(

    @Schema(description = "일차 (1부터)", example = "1")
    @Min(value = 1, message = PlanValidationMessage.ITEM_DAY_MIN_INVALID)
    int day,

    @Schema(description = "같은 일차 내 표시 순서 (0부터)", example = "0")
    int sequence,

    @Schema(description = "항목 유형", example = "PLACE")
    @NotNull(message = PlanValidationMessage.ITEM_TYPE_REQUIRED)
    PlanItemType itemType,

    @Schema(description = "대상 아이디 (PLACE/MEAL/LODGING은 place.id, WALK는 walk_course.id)", example = "126439")
    Long targetId,

    @Schema(description = "항목 이름", example = "천지연폭포")
    @NotBlank(message = PlanValidationMessage.ITEM_TITLE_REQUIRED)
    @Size(max = 100, message = PlanValidationMessage.ITEM_TITLE_LENGTH_INVALID)
    String title,

    @Schema(description = "메모", example = "그늘이 많아 더위에 약한 아이도 괜찮음")
    @Size(max = 500, message = PlanValidationMessage.MEMO_LENGTH_INVALID)
    String memo,

    @Schema(description = "시작 시각", example = "10:30:00")
    LocalTime startTime
) {

    public PlanItemCommand toCommand() {
        return PlanItemCommand.builder()
            .day(day)
            .sequence(sequence)
            .itemType(itemType)
            .targetId(targetId)
            .title(title)
            .memo(memo)
            .startTime(startTime)
            .build();
    }
}
