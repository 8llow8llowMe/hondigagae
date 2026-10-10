package com.hondigagae.domainlayer.planner.adapter.in.web.dto.item;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

@Builder
@Schema(description = "AI 일정 초안의 개별 일정 항목 DTO")
public record AiPlanScheduleItem(

    @Schema(description = "일정 항목 종류 코드 (plan-service PlanItemType 과 같은 코드). "
        + "**초안에는 PLACE 장소 · MEAL 식사 · LODGING 숙박 셋만 나옵니다** — 서버가 후보 장소의 분류로 정합니다"
        + "(숙박 → LODGING, 음식점 → MEAL, 그 밖 → PLACE). 장소 없는 항목(빈 식사 자리 · MOVE 이동)은 만들지 않습니다. "
        + "`WALK` 는 targetId 가 walk_course.id 인데 AI 는 산책 코스 후보를 보지 않으므로 그 아이디를 알 수 없습니다. "
        + "산책 일정은 장소 항목으로 나오고 그 성격은 note 에 담깁니다. 마지막 날에는 숙박이 없습니다",
        example = "PLACE")
    String itemType,

    @Schema(
        description = "장소 아이디 (숫자 문자열). plan-service 에 저장할 때 **targetId 로 그대로 쓰면 됩니다** — "
            + "초안의 itemType 은 모두 place.id 를 targetId 로 받는 유형이라 아이디 공간이 어긋나지 않습니다. "
            + "초안 항목에는 언제나 장소가 있습니다 — nullable 은 계약상 남겨 둔 것입니다(plan-service targetId 와 같은 모양)",
        example = "212481712381923328", nullable = true)
    String placeId,

    @Schema(description = "항목 이름. 서버가 가진 후보 장소의 이름 그대로입니다", example = "애월한담공원")
    String title,

    @Schema(description = "참고 메모. 이 항목을 넣은 이유나 주의점을 반려견 관점에서 한 문장으로 담는다", example = "목줄 착용 필수")
    String note
) {

}
