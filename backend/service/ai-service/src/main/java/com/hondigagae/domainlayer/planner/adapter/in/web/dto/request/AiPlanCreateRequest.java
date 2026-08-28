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

    @Schema(description = "여행 지역 코드 (관광 areaCode, 제주=39)", example = "39")
    @NotBlank(message = AiPlanValidationMessage.AREA_CODE_REQUIRED)
    String areaCode,

    @Schema(description = "여행 시작일", example = "2026-09-11")
    @NotNull(message = AiPlanValidationMessage.START_DATE_REQUIRED)
    LocalDate startDate,

    @Schema(description = "여행 종료일", example = "2026-09-13")
    @NotNull(message = AiPlanValidationMessage.END_DATE_REQUIRED)
    LocalDate endDate,

    @Schema(description = "예산 (원 단위, 선택)", example = "400000")
    @Positive(message = AiPlanValidationMessage.BUDGET_POSITIVE)
    Long budget,

    @Schema(description = "동반 반려견 식별자 (선택) — petIds 가 있으면 무시됩니다. 둘 다 없으면 대표 반려견이 쓰입니다.",
        example = "1234567890123456789")
    @Positive(message = AiPlanValidationMessage.PET_ID_POSITIVE)
    Long petId,

    @Schema(description = "동반 반려견 식별자 목록 (선택, 최대 5마리) — 여러 마리와 함께 여행할 때 씁니다.")
    @Size(max = 5, message = AiPlanValidationMessage.PET_IDS_SIZE_INVALID)
    List<@Positive(message = AiPlanValidationMessage.PET_ID_POSITIVE) Long> petIds,

    @Schema(description = "꼭 넣고 싶은 장소 식별자 목록 (선택, 최대 10곳) — 일정에 반드시 배치됩니다.")
    @Size(max = 10, message = AiPlanValidationMessage.PINNED_PLACE_IDS_SIZE_INVALID)
    List<@Positive(message = AiPlanValidationMessage.PINNED_PLACE_ID_POSITIVE) Long> pinnedPlaceIds,

    @Schema(description = "요청 메모 (선택) — 자연어 요구사항", example = "산책 위주로, 더위에 약한 아이라 실내 위주로 부탁해요")
    @Size(max = 500, message = AiPlanValidationMessage.REQUEST_NOTE_LENGTH_INVALID)
    String requestNote,

    @Schema(description = "하루 재생성 대상 일정 식별자 (선택) — regenerateDay 와 함께 지정합니다.", example = "1234567890123456789")
    @Positive(message = AiPlanValidationMessage.PLAN_ID_POSITIVE)
    Long planId,

    @Schema(description = "다시 구성할 일차 (선택, 1부터) — 지정한 날만 새로 짜고 나머지 날은 기존 일정을 유지합니다.", example = "2")
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
