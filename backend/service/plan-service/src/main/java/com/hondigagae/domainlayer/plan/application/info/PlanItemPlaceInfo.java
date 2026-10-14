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
 *
 * @param contentTypeCode 장소 유형 코드(enum 이름, 예 {@code RESTAURANT}). 이미 PLACE 로 담긴 음식점을 프론트가 식사로 세는
 *                        판정 키다 (#1461)
 * @param contentTypeName 장소 유형 표시명(예 {@code 음식점})
 * @param contentTypeDescription 장소 유형 설명(예 {@code 음식점, 카페}). 공개 장소 API 의 {@code contentType.description} 과 같은 값
 * @param sourceCategory  원천의 원본 분류(카페 등). 같은 음식점 유형 안에서 카페를 가른다
 */
@Builder
public record PlanItemPlaceInfo(
    String addr1,
    Boolean indoor,
    String firstImage,
    Double lat,
    Double lng,
    String contentTypeCode,
    String contentTypeName,
    String contentTypeDescription,
    String sourceCategory
) {

}
