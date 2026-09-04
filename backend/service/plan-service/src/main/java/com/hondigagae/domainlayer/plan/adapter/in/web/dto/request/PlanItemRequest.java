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

    @Schema(description = "일차 (1부터). 일정 생성 요청에서는 필수, 일자별 일괄 교체 요청에서는 경로의 day 로 덮어쓰므로 생략 가능", example = "1")
    @Min(value = 1, message = PlanValidationMessage.ITEM_DAY_MIN_INVALID)
    Integer day,

    @Schema(description = "생략 가능. 같은 일차 내 표시 순서(0부터). 생략하면 0이고, 같은 일차 안에서 겹치면 실패합니다.", example = "0")
    int sequence,

    @Schema(description = "항목 유형. PLACE 장소 · MEAL 식사 · LODGING 숙박 · WALK 산책 · MOVE 이동", example = "PLACE",
        requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = PlanValidationMessage.ITEM_TYPE_REQUIRED)
    PlanItemType itemType,

    @Schema(description = "생략 가능. 대상 아이디 — PLACE/MEAL/LODGING 은 place.id(tour-service 에서 존재 검증), WALK 는 walk_course.id, MOVE 는 비워 둡니다. "
        + "생략하면 대상 없는 항목으로 저장됩니다. Snowflake 라 예시 값은 형식 안내용", example = "212481712381923328")
    Long targetId,

    @Schema(description = "항목 이름 (100자 이하)", example = "천지연폭포", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = PlanValidationMessage.ITEM_TITLE_REQUIRED)
    @Size(max = 100, message = PlanValidationMessage.ITEM_TITLE_LENGTH_INVALID)
    String title,

    @Schema(description = "생략 가능. 메모(500자 이하). 생략하면 비워 둡니다.", example = "그늘이 많아 더위에 약한 아이도 괜찮음")
    @Size(max = 500, message = PlanValidationMessage.MEMO_LENGTH_INVALID)
    String memo,

    @Schema(description = "생략 가능. 시작 시각 (HH:mm:ss). 생략하면 비워 둡니다.", example = "10:30:00")
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
