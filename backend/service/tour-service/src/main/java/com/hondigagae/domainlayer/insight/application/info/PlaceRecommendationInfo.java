package com.hondigagae.domainlayer.insight.application.info;

import com.hondigagae.domainlayer.insight.domain.model.WeatherWarning;
import java.time.LocalDate;
import java.util.List;
import lombok.Builder;

/**
 * 장소 추천 결과 (#1368).
 *
 * <p>특보는 지역 공통이라 목록 머리에 한 번만 싣는다. 장소마다 반복하면 화면이 같은 특보를 카드 수만큼 그린다.
 *
 * @param weatherWarning 발효 중인 가장 무거운 특보. 기준 일자가 오늘이 아니거나 없으면 null 이다
 * @param places         추천 순서대로. 추천할 곳이 없으면 빈 목록이다
 */
@Builder
public record PlaceRecommendationInfo(
    LocalDate targetDate,
    WeatherWarning weatherWarning,
    List<RecommendedPlaceInfo> places
) {

}
