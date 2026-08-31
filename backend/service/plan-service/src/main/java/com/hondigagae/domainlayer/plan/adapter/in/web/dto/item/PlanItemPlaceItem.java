package com.hondigagae.domainlayer.plan.adapter.in.web.dto.item;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

/**
 * 일정 항목이 가리키는 장소 요약.
 *
 * <p>필드명은 tour-service 의 목록 항목({@code PlaceItem})과 맞췄다 — 같은 값을 두 API 에서
 * 다른 이름으로 받으면 프론트가 변환 계층을 하나 더 만들게 된다.
 */
@Builder
@Schema(description = "일정 항목의 장소 요약. 장소를 가리키지 않는 항목이거나 원천에서 사라진 장소면 null 이다")
public record PlanItemPlaceItem(

    @Schema(description = "주소", example = "제주특별자치도 제주시 한림읍 용금로 906-107", nullable = true)
    String addr1,

    @Schema(
        description = "실내 여부. **null 은 실외가 아니라 원천에 정보가 없다는 뜻이다** — "
            + "화면은 false(실외)와 다르게 다뤄야 한다",
        example = "true", nullable = true)
    Boolean indoor,

    @Schema(description = "대표 이미지 URL", nullable = true)
    String firstImage,

    @Schema(description = "위도. 항목 간 이동 거리 계산에 쓴다", example = "33.3608276172", nullable = true)
    Double lat,

    @Schema(description = "경도", example = "126.4106264", nullable = true)
    Double lng
) {
}
