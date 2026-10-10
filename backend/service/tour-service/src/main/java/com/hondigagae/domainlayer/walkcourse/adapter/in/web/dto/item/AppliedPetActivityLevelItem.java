package com.hondigagae.domainlayer.walkcourse.adapter.in.web.dto.item;

import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

/**
 * 목록에 적용된 반려견 활동량 필터와 그 소요시간 상한 (#718).
 *
 * <p>상한을 별도 숫자 필드로 내리는 이유는 {@code level.description} 이 <b>반려견 성향</b>
 * 설명이기 때문이다 ("짧은 산책을 선호하며 장시간 활동을 힘들어합니다"). 그 문구는 내부 API 가
 * plan-service 로 내려보내는 것과 같은 값이라, 여기에 "4시간 이하" 를 섞으면 같은 enum 이 API 마다
 * 다른 설명을 말하게 된다.
 *
 * <p>상한의 정본은 서버({@code WalkCourseActivityFit}) 하나다 - 화면이 4시간·6시간을 제 상수로
 * 적으면 서버가 상한을 바꿔도 화면만 옛 숫자를 말한다.
 */
@Builder
@Schema(description = "적용된 반려견 활동량 필터 DTO. 활동량 필터를 적용하지 않은 조회에서는 이 객체 자체가 null 이다")
public record AppliedPetActivityLevelItem(

    @Schema(description = "적용된 활동량. description 은 반려견 성향 설명이며 소요시간 상한이 아니다 — 상한은 maxDurationMinutes 로 본다",
        example = "{\"code\":\"LOW\",\"name\":\"낮음\",\"description\":\"짧은 산책을 선호하며 장시간 활동을 힘들어합니다.\"}")
    CodeNameDescriptionMetadata level,

    @Schema(
        description = "이 활동량이 걸을 수 있는 코스 소요시간 상한(분). 목록은 이 상한 이하인 코스만 담았다. "
            + "**HIGH 는 상한이 없어 null 이다** — 객체 전체가 null 인 것(활동량 필터 미적용)과 뜻이 다르다. "
            + "상한의 정본은 서버라 화면은 이 값을 그대로 보여 준다",
        example = "240", nullable = true)
    Integer maxDurationMinutes
) {
}
