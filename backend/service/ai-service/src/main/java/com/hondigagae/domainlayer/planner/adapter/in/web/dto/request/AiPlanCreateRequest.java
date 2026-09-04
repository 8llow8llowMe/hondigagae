package com.hondigagae.domainlayer.planner.adapter.in.web.dto.request;

import com.hondigagae.domainlayer.planner.application.command.AiPlanCreateCommand;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanValidationMessage;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import lombok.Builder;

@Builder
@Schema(description = "AI 여행 일정 생성 요청 DTO")
public record AiPlanCreateRequest(

    @Schema(description = "여행 지역 코드 (관광 areaCode, 제주=39)", example = "39",
        requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = AiPlanValidationMessage.AREA_CODE_REQUIRED)
    String areaCode,

    @Schema(description = "여행 시작일 (yyyy-MM-dd). 오늘 또는 그 이후여야 합니다", example = "2026-09-11",
        requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = AiPlanValidationMessage.START_DATE_REQUIRED)
    LocalDate startDate,

    @Schema(description = "여행 종료일 (yyyy-MM-dd). 시작일과 같거나 이후여야 하고, 기간은 최대 10일입니다", example = "2026-09-13",
        requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = AiPlanValidationMessage.END_DATE_REQUIRED)
    LocalDate endDate,

    @Schema(description = "예산 (원 단위, 0보다 큰 값). 생략 가능. 생략하면 예산 조건 없이 짭니다", example = "400000")
    @Positive(message = AiPlanValidationMessage.BUDGET_POSITIVE)
    Long budget,

    @Schema(description = "동반 반려견 식별자 한 마리. 생략 가능. petIds 가 있으면 무시되고, 둘 다 없으면 회원의 대표 반려견으로 짭니다",
        example = "1234567890123456789")
    @Positive(message = AiPlanValidationMessage.PET_ID_POSITIVE)
    Long petId,

    @Schema(description = "동반 반려견 식별자 목록 (최대 5마리). 생략 가능. 생략하면 petId 를, 그것도 없으면 대표 반려견을 씁니다. 중복은 한 마리로 접힙니다",
        example = "[1, 2]")
    @Size(max = 5, message = AiPlanValidationMessage.PET_IDS_SIZE_INVALID)
    // 원소 제약은 @NotNull 과 값 제약을 쌍으로 건다 (coding-conventions §8-2).
    // @Positive 만 걸면 null 원소가 통과해 조용히 사라지고 대표 반려견으로 폴백된다.
    List<@NotNull(message = AiPlanValidationMessage.PET_ID_POSITIVE)
         @Positive(message = AiPlanValidationMessage.PET_ID_POSITIVE) Long> petIds,

    @Schema(description = "꼭 넣고 싶은 장소 식별자 목록 (최대 10곳). 생략 가능. 지정하면 일정에 반드시 배치되고, 없는 장소가 섞이면 작업이 AIPLAN_013 으로 실패합니다. 생략하면 후보 검색 결과만으로 짭니다",
        example = "[212481712381923328, 212481712381923329]")
    @Size(max = 10, message = AiPlanValidationMessage.PINNED_PLACE_IDS_SIZE_INVALID)
    // 여기서 null 을 흘리면 "꼭 넣고 싶은 장소"가 말없이 하나 사라진다 -
    // 반드시 배치된다고 약속받은 값이라 조용히 버리면 안 되는 자리다.
    List<@NotNull(message = AiPlanValidationMessage.PINNED_PLACE_ID_POSITIVE)
         @Positive(message = AiPlanValidationMessage.PINNED_PLACE_ID_POSITIVE) Long> pinnedPlaceIds,

    @Schema(description = "요청 메모 — 자연어 요구사항 (500자 이하). 생략 가능. 생략하면 메모 없이 짭니다",
        example = "산책 위주로, 더위에 약한 아이라 실내 위주로 부탁해요")
    @Size(max = 500, message = AiPlanValidationMessage.REQUEST_NOTE_LENGTH_INVALID)
    String requestNote,

    @Schema(description = "즐겨찾기 우선 반영. 생략 가능. 생략하면 false 로 보고 찜한 장소를 따로 반영하지 않습니다. true 면 찜한 장소를 후보에 합치고 조건이 맞으면 우선 배치합니다",
        example = "true")
    Boolean preferFavorites,

    @Schema(description = "하루 재생성 대상 일정 식별자. 생략 가능. regenerateDay 와 함께 줘야 하며(하나만 주면 AIPLAN_014), 둘 다 생략하면 새 일정 전체를 짭니다",
        example = "1234567890123456789")
    @Positive(message = AiPlanValidationMessage.PLAN_ID_POSITIVE)
    Long planId,

    @Schema(description = "다시 구성할 일차 (1부터). 생략 가능. planId 와 함께 줘야 하며, 지정한 날만 새로 짜고 나머지 날은 기존 일정을 유지합니다. 여행 기간을 벗어나면 AIPLAN_015",
        example = "2")
    @Positive(message = AiPlanValidationMessage.REGENERATE_DAY_POSITIVE)
    Integer regenerateDay
) {

    public AiPlanCreateCommand toCommand() {
        return AiPlanCreateCommand.builder()
            .areaCode(areaCode)
            .startDate(startDate)
            .endDate(endDate)
            .budget(budget)
            .petIds(effectivePetIds())
            .pinnedPlaceIds(pinnedPlaceIds == null ? List.of() : pinnedPlaceIds.stream().distinct().toList())
            .requestNote(requestNote)
            .preferFavorites(Boolean.TRUE.equals(preferFavorites))
            .planId(planId)
            .regenerateDay(regenerateDay)
            .build();
    }

    /**
     * petIds 가 있으면 그것을, 없으면 단일 petId 를 목록으로 만든다. 둘 다 없으면 빈 목록 —
     * 워커가 대표 반려견으로 대신한다. 중복 지정은 한 마리로 접는다.
     */
    private List<Long> effectivePetIds() {
        if (petIds != null && !petIds.isEmpty()) {
            return petIds.stream().distinct().toList();
        }
        return petId == null ? List.of() : List.of(petId);
    }
}
