package com.hondigagae.domainlayer.insight.application.info;

import com.hondigagae.domainlayer.insight.domain.model.CongestionSnapshot;
import com.hondigagae.domainlayer.insight.domain.model.DailyWeather;
import com.hondigagae.domainlayer.insight.domain.model.SuitabilityScore;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import java.util.List;
import lombok.Builder;

/**
 * 추천된 장소 한 곳 — 목록 카드 요약 + 그 장소의 적합도 판정 (#1368).
 *
 * <p>판정 부분은 적합도 한 곳 조회({@link PlaceSuitabilityInfo})와 같은 값이다. 같은 장소 · 같은 날짜 · 같은 반려견
 * 조건이면 두 화면이 같은 점수와 같은 결론을 말해야 한다.
 */
@Builder
public record RecommendedPlaceInfo(
    long placeId,
    String contentTypeId,
    String title,
    String addr1,
    String sigunguCode,
    Double lat,
    Double lng,
    String firstImage,
    String firstImage2,
    PetAllowanceType petAllowanceType,
    Integer maxPetWeightKg,
    Boolean indoor,
    // 추천에 오른 장소는 점수가 있다 — 점수를 못 낸 곳은 후보에서 뺀다.
    SuitabilityScore score,
    String headline,
    // 그 장소 격자의 그날 날씨
    DailyWeather weather,
    CongestionSnapshot congestion,
    // 비 예보이고 실내가 없는 곳만 채운다. 최종 선정된 장소에만 조회한다.
    List<AlternativePlaceInfo> indoorAlternatives,
    boolean petConditionApplied
) {

}
