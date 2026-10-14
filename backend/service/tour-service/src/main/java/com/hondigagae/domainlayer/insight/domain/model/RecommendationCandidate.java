package com.hondigagae.domainlayer.insight.domain.model;

import lombok.Builder;

/**
 * 장소 추천 후보 한 곳 (#1368).
 *
 * <p>판정 입력({@link PlaceCondition})에 목록 카드가 그릴 요약 필드만 더한 것이다. 추천 결과는 목록 카드로 그려지므로
 * 장소 목록({@code PlaceItem})과 같은 뜻의 필드를 같은 값으로 내려야 하는데, 판정 입력에 그 필드를 섞으면 적합도 한
 * 곳 판정에 쓰지 않는 값이 판정 모델에 늘어난다. 그래서 감싼다.
 *
 * <p><b>예외 — 유형 · 원본 분류(#1461).</b> 실내 대안은 이 래퍼 없이 {@link PlaceCondition} 만으로 만들고, 그 응답이 담기
 * 판정({@code placeItemTypeOf})에 쓰이도록 판정 입력에도 {@code contentTypeId} · {@code sourceCategory} 가 실렸다. 그래서
 * {@code contentTypeId} 는 이 래퍼와 {@code place()} 에 같은 엔티티 칸이 둘 있다. <b>카드와 다양성 제한은 이 래퍼의 칸을
 * 읽는다</b> — 추천 경로에서 {@code place().contentTypeId()} 를 읽지 않는다(테스트 fixture 는 그 칸을 비워 둔다).
 *
 * @param contentTypeId 관광공사 콘텐츠 유형 코드(12 관광지 등). 다양성 제한도 이 값으로 센다. {@code place.contentTypeId()} 와
 *                      같은 엔티티 칸이다 — 판정 입력에는 실내 대안 응답용으로 실렸고(#1461), 카드와 다양성 제한은 이 칸을 읽는다
 */
@Builder
public record RecommendationCandidate(
    PlaceCondition place,
    String contentTypeId,
    String addr1,
    String firstImage,
    String firstImage2,
    Integer maxPetWeightKg
) {

    public long placeId() {
        return place.placeId();
    }
}
