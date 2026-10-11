package com.hondigagae.domainlayer.insight.domain.model;

import lombok.Builder;

/**
 * 장소 추천 후보 한 곳 (#1368).
 *
 * <p>판정 입력({@link PlaceCondition})에 목록 카드가 그릴 요약 필드만 더한 것이다. 추천 결과는 목록 카드로 그려지므로
 * 장소 목록({@code PlaceItem})과 같은 뜻의 필드를 같은 값으로 내려야 하는데, 판정 입력에 그 필드를 섞으면 적합도 한
 * 곳 판정에 쓰지 않는 값이 판정 모델에 늘어난다. 그래서 감싼다.
 *
 * @param contentTypeId 관광공사 콘텐츠 유형 코드(12 관광지 등). 다양성 제한도 이 값으로 센다
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
