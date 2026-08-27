package com.hondigagae.domainlayer.insight.application.port.in;

import com.hondigagae.domainlayer.insight.adapter.in.web.dto.response.PlaceSuitabilityResponse;
import com.hondigagae.domainlayer.insight.adapter.in.web.dto.response.WalkSafetyResponse;
import com.hondigagae.domainlayer.insight.application.model.PlaceInsightQuery;

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
}
