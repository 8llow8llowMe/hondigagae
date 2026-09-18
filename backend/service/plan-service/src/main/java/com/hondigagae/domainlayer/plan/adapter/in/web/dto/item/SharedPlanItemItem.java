package com.hondigagae.domainlayer.plan.adapter.in.web.dto.item;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalTime;
import lombok.Builder;

/**
 * 공유 링크로 보이는 일정 항목 (이슈 #627).
 *
 * <p><b>{@link PlanItemDetailItem} 에서 의도적으로 뺀 것</b>: {@code planItemId}(편집용 식별자),
 * {@code memo}(주인의 사적인 메모), {@code visited}(여행 중 체크). 링크를 받은 사람은 "어디를
 * 언제 가는지" 만 보면 되고, 그 셋은 주인만 쓰는 값이다.
 *
 * <p>필드를 더하기 전에 {@code PlanShareLinkPresenterTest} 가 고정한 이름 집합을 먼저 본다 —
 * 그 테스트가 깨지는 것이 곧 "이 값을 남에게 보여도 되는가" 를 다시 묻는 자리다.
 *
 * <p><b>{@code walkCourse} 를 더할 때 그 질문에 답했다</b> (#719). 빼 둔 셋은 <b>주인만 쓰는
 * 값</b>이라 뺀 것인데, 코스 요약은 제주올레 공공데이터이고 이미 싣고 있는 {@code place} 와 같은
 * 성격이다 — 링크를 받은 사람이 "어디를 언제 가는지" 를 아는 데 필요한 값이다. 오히려 빠져 있던
 * 쪽이 비대칭이었다: 장소 항목은 요약이 실리는데 {@code WALK} 만 제목 한 줄로 남아, 주인이 보는
 * 화면과 공유받은 사람이 보는 화면이 같은 항목을 다르게 설명했다.
 */
@Builder
@Schema(description = "공유된 여행 일정의 항목 DTO (읽기 전용)")
public record SharedPlanItemItem(

    @Schema(description = "일차 (1부터)", example = "1")
    int day,

    @Schema(description = "같은 일차 내 표시 순서", example = "0")
    int sequence,

    @Schema(description = "항목 유형", example = "{\"code\":\"PLACE\",\"name\":\"장소\",\"description\":\"관광지·카페 등 방문 장소 항목입니다.\"}")
    CodeNameDescriptionMetadata itemType,

    @Schema(
        description = "대상 아이디 (항목 유형에 따라 place.id 또는 walk_course.id). "
            + "Snowflake 라 문자열로 내리며, 이동 항목처럼 대상이 없으면 null 이다",
        example = "212481712381923328", nullable = true)
    String targetId,

    @Schema(description = "항목 이름", example = "천지연폭포")
    String title,

    @Schema(description = "시작 시각", example = "10:30:00", nullable = true)
    LocalTime startTime,

    @Schema(
        description = "항목이 가리키는 장소 요약. 장소를 가리키지 않는 항목(WALK·MOVE)이거나 "
            + "원천에서 사라진(delisted) 장소면 null 이다 — 그때도 항목 자체는 응답에 남는다",
        nullable = true)
    PlanItemPlaceItem place,

    @Schema(
        description = "항목이 가리키는 산책 코스 요약. 산책 항목이 아니거나 원천에서 사라진 코스면 null 이다 — "
            + "장소와 같은 규칙이고, 일정 상세(PlanItemDetailItem.walkCourse)와 같은 모양이라 화면이 렌더를 "
            + "재사용한다. 코스 없음·tour-service 장애를 가르지 않고 셋 다 같은 null 이다",
        nullable = true)
    PlanItemWalkCourseItem walkCourse
) {
}
