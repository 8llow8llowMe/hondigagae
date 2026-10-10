package com.hondigagae.domainlayer.plan.adapter.in.web.dto.request;

import com.hondigagae.domainlayer.plan.application.command.PlanUpdateCommand;
import com.hondigagae.domainlayer.plan.application.exception.PlanValidationMessage;
import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;

/**
 * 일정 기본 정보 수정 요청. 전달한 필드만 반영하고 null은 기존 값을 유지한다.
 *
 * <p>{@code petIds} 규칙은 {@link PlanCreateRequest} 와 <b>같다</b> — 최대 5마리, 첫 번째가
 * 대표, 소유하지 않은 아이가 있으면 {@code PLAN_011}. 다만 <b>폴백은 없다</b>: 생성은 빈
 * 목록을 대표 반려견으로 대신하지만, 수정에서 빈 목록은 "동행견을 모두 빼겠다" 는 뜻이라
 * 대표 반려견으로 되살리면 사용자가 지우려던 아이가 말없이 돌아온다.
 */
@Schema(description = "여행 일정 수정 요청 DTO")
public record PlanUpdateRequest(

    @Schema(description = "생략 가능. 일정 제목(60자 이하, 공백만으로는 불가). 생략하면 기존 값 유지", example = "몽실이와 제주 2박 3일")
    // null 은 "유지" 라 @NotBlank 를 못 쓴다. 보냈다면 내용이 있어야 한다 — 빈 문자열이 통과하면
    // 제목 없는 일정이 목록에 남는다. (@Pattern 은 null 을 검사하지 않는다)
    @Pattern(regexp = ".*\\S.*", message = PlanValidationMessage.TITLE_REQUIRED)
    @Size(max = 60, message = PlanValidationMessage.TITLE_LENGTH_INVALID)
    String title,

    @Schema(description = "생략 가능. 여행 시작일 (yyyy-MM-dd). 생략하면 기존 값 유지", example = "2026-09-12")
    LocalDate startDate,

    @Schema(description = "생략 가능. 여행 종료일 (yyyy-MM-dd). 생략하면 기존 값 유지. 시작일 이후여야 하고 기간은 최대 30일", example = "2026-09-14")
    LocalDate endDate,

    @Schema(description = "생략 가능. 예산(원, 0 이상). 생략하면 기존 값 유지", example = "400000")
    @PositiveOrZero(message = PlanValidationMessage.BUDGET_NEGATIVE_INVALID)
    Integer budget,

    @Schema(description = "생략 가능. 일정 상태. DRAFT 초안 · CONFIRMED 확정 · COMPLETED 완료. 생략하면 기존 값 유지", example = "CONFIRMED")
    PlanStatus status,

    @Schema(description = "생략 가능. 동행 반려견 아이디 목록(최대 5마리) — 첫 번째가 대표 반려견이 됩니다. "
        + "생략하면 기존 동행견을 유지하고, 보내면 목록 전체를 그대로 교체합니다. 빈 목록은 거절합니다(PLAN_010).",
        example = "[1, 2]")
    @Size(max = 5, message = PlanValidationMessage.PET_IDS_SIZE_INVALID)
    // 원소 제약은 @NotNull 과 값 제약을 쌍으로 건다 (coding-conventions §8-2).
    // @Positive 만 걸면 null 원소가 통과해 저장에서 500 이 난다 - 스펙상 @Positive 는 null 을 유효로 본다.
    List<@NotNull(message = PlanValidationMessage.PET_ID_POSITIVE)
         @Positive(message = PlanValidationMessage.PET_ID_POSITIVE) Long> petIds
) {

    public PlanUpdateCommand toCommand() {
        return PlanUpdateCommand.builder()
            .title(title)
            .startDate(startDate)
            .endDate(endDate)
            .budget(budget)
            .status(status)
            // null 은 "유지" 라 그대로 넘긴다. 보냈다면 중복은 한 마리로 접되 순서는 지킨다
            // - 첫 번째가 대표 반려견이라 순서가 의미를 갖는다 (생성과 같은 규칙).
            .petIds(petIds == null ? null : petIds.stream().distinct().toList())
            .build();
    }
}
