package com.hondigagae.domainlayer.plan.application.info;

import lombok.Builder;

/**
 * 일정 항목에 붙는 장소 요약 (이슈 #86).
 *
 * <p>프론트가 항목마다 {@code GET /places/{placeId}} 를 부르던 것을 없애기 위한 것이다 —
 * 3일·6항목이면 왕복 6번이었다.
 *
 * <p>필드는 전부 nullable 이다. 원천이 주지 않는 값이 흔하고, 특히 {@code indoor} 의 null 은
 * <b>"실외"가 아니라 "원천에 정보 없음"</b> 이다.
 */
@Builder
public record PlanItemPlaceInfo(
    String addr1,
    Boolean indoor,
    String firstImage,
    Double lat,
    Double lng
) {

}
