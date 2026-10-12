package com.hondigagae.domainlayer.insight.application.port.in;

import com.hondigagae.domainlayer.insight.adapter.in.web.dto.response.PlaceCongestionResponse;
import com.hondigagae.domainlayer.insight.adapter.in.web.dto.response.PlaceRecommendationResponse;
import com.hondigagae.domainlayer.insight.adapter.in.web.dto.response.PlaceSuitabilityResponse;
import com.hondigagae.domainlayer.insight.adapter.in.web.dto.response.WalkSafetyResponse;
import com.hondigagae.domainlayer.insight.application.model.PlaceInsightQuery;
import com.hondigagae.domainlayer.insight.application.model.PlaceRecommendationQuery;
import java.time.LocalDate;

/**
 * 장소 단위 인사이트 유스케이스.
 *
 * <p>적합도와 산책 위험도를 한 유스케이스로 묶은 이유는 입력이 같아서다(장소 + 날짜 + 반려견
 * 조건). 대답하는 질문은 다르지만 - 적합도는 "갈 만한가", 위험도는 "지금 걸어도 되는가" -
 * 진입점을 나누면 같은 조건을 두 번 정의하게 된다.
 */
public interface PlaceInsightWebUseCase {

    PlaceSuitabilityResponse getSuitability(PlaceInsightQuery query);

    WalkSafetyResponse getWalkSafety(PlaceInsightQuery query);

    /**
     * 기간 혼잡도. 적합도·위험도와 입력이 달라({@code PlaceInsightQuery} 가 아니라 날짜 범위)
     * 파라미터를 그대로 받는다.
     */
    PlaceCongestionResponse getCongestions(long placeId, LocalDate fromDate, LocalDate toDate);

    /**
     * 장소 추천 (#1368). 적합도와 같은 날짜 · 반려견 조건으로 지역 안의 후보를 판정해 순위를 매긴다.
     * 특정 장소가 아니라 장소 목록을 답하므로 {@code PlaceInsightQuery} 대신 개수를 담은 조건을 받는다.
     */
    PlaceRecommendationResponse getRecommendations(PlaceRecommendationQuery query);
}
