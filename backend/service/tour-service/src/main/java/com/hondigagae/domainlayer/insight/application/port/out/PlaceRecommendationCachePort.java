package com.hondigagae.domainlayer.insight.application.port.out;

import com.hondigagae.domainlayer.insight.application.model.PlaceRecommendationCacheKey;
import com.hondigagae.domainlayer.insight.application.port.out.query.CachedPlaceRecommendationQueryResult;
import java.time.Duration;
import java.util.Optional;

/**
 * 장소 추천 결과 캐시 계약 (#1368).
 *
 * <p>추천 한 번은 후보 수십 곳을 판정한다. 같은 날짜 · 같은 반려견 조건 · 같은 개수의 요청이 홈 화면마다 반복되므로
 * 결과를 짧게 둔다. <b>캐시 장애는 미스로 취급한다</b> — 캐시가 죽었다고 추천이 멎으면 안 된다.
 *
 * <p>키를 어떤 문자열로 접는지는 어댑터가 정한다.
 */
public interface PlaceRecommendationCachePort {

    Optional<CachedPlaceRecommendationQueryResult> find(PlaceRecommendationCacheKey key);

    void put(PlaceRecommendationCacheKey key, CachedPlaceRecommendationQueryResult result, Duration ttl);
}
