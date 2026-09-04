package com.hondigagae.domainlayer.plan.adapter.in.web.dto.request;

import com.hondigagae.domainlayer.plan.application.command.PlanCreateCommand;
import com.hondigagae.domainlayer.plan.application.command.PlanItemCommand;
import com.hondigagae.domainlayer.plan.application.exception.PlanValidationMessage;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;

/**
 * 반려견 지정 규칙은 ai-service 의 {@code AiPlanCreateRequest} 와 <b>똑같다</b> — {@code petIds} 가
 * 있으면 그것을, 없으면 {@code petId} 를, 둘 다 없으면 대표 반려견을 쓴다. 두 서비스가 다르게 굴면
 * 프론트가 생성과 담기에서 반려견을 서로 다른 모양으로 실어야 한다.
 */
@Schema(description = "여행 일정 생성 요청 DTO")
public record PlanCreateRequest(

    @Schema(description = "생략 가능. 대상 반려견 아이디 — petIds 가 있으면 무시되고, 둘 다 생략하면 대표 반려견이 쓰입니다.",
        example = "1234567890123456789")
    @Positive(message = PlanValidationMessage.PET_ID_POSITIVE)
    Long petId,

    @Schema(description = "생략 가능. 동행 반려견 아이디 목록(최대 5마리) — 첫 번째가 대표 반려견이 되고, 생략하면 petId 또는 대표 반려견을 씁니다.",
        example = "[1, 2]")
    @Size(max = 5, message = PlanValidationMessage.PET_IDS_SIZE_INVALID)
    // 원소 제약은 @NotNull 과 값 제약을 쌍으로 건다 (coding-conventions §8-2).
    // @Positive 만 걸면 null 원소가 통과해 저장에서 500 이 난다 - 스펙상 @Positive 는 null 을 유효로 본다.
    List<@NotNull(message = PlanValidationMessage.PET_ID_POSITIVE)
         @Positive(message = PlanValidationMessage.PET_ID_POSITIVE) Long> petIds,

    @Schema(description = "지역 코드 (제주=39)", example = "39", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = PlanValidationMessage.AREA_CODE_REQUIRED)
    String areaCode,

    @Schema(description = "생략 가능. 시군구 코드(TourAPI sigunguCode). 생략하면 비워 둡니다.", example = "4")
    String sigunguCode,

    @Schema(description = "일정 제목 (60자 이하)", example = "몽실이와 제주 2박 3일", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = PlanValidationMessage.TITLE_REQUIRED)
    @Size(max = 60, message = PlanValidationMessage.TITLE_LENGTH_INVALID)
    String title,

    @Schema(description = "여행 시작일 (yyyy-MM-dd)", example = "2026-09-12", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = PlanValidationMessage.START_DATE_REQUIRED)
    LocalDate startDate,

    @Schema(description = "여행 종료일 (yyyy-MM-dd). 시작일과 같거나 이후여야 하고 기간은 최대 30일입니다.", example = "2026-09-14",
        requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = PlanValidationMessage.END_DATE_REQUIRED)
    LocalDate endDate,

    @Schema(description = "생략 가능. 예산(원, 0 이상). 생략하면 비워 둡니다.", example = "400000")
    @PositiveOrZero(message = PlanValidationMessage.BUDGET_NEGATIVE_INVALID)
    Integer budget,

    @Schema(description = "생략 가능. 일정 항목 목록. 생략하면 항목 없는 일정으로 생성되고, 보낼 때는 각 항목의 day 가 필수입니다.")
    @Valid
    List<PlanItemRequest> items
) {

    public PlanCreateCommand toCommand() {
        List<PlanItemCommand> itemCommands = items == null ? List.of()
            : items.stream().map(PlanItemRequest::toCommand).toList();

        return PlanCreateCommand.builder()
            .petIds(effectivePetIds())
            .areaCode(areaCode)
            .sigunguCode(sigunguCode)
            .title(title)
            .startDate(startDate)
            .endDate(endDate)
            .budget(budget)
            .items(itemCommands)
            .build();
    }

    /**
     * petIds 가 있으면 그것을, 없으면 단일 petId 를 목록으로 만든다. 둘 다 없으면 빈 목록 —
     * Processor 가 대표 반려견으로 대신한다. 중복 지정은 한 마리로 접되 순서는 지킨다
     * (첫 번째가 대표 반려견이다).
     */
    private List<Long> effectivePetIds() {
        if (petIds != null && !petIds.isEmpty()) {
            return petIds.stream().distinct().toList();
        }
        return petId == null ? List.of() : List.of(petId);
    }
}
