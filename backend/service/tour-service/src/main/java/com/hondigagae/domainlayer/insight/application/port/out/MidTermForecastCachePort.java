package com.hondigagae.domainlayer.insight.application.port.out;

import com.hondigagae.domainlayer.insight.application.port.out.query.CachedMidTermQueryResult;
import com.hondigagae.domainlayer.insight.domain.enums.MidTermRegion;
import com.hondigagae.domainlayer.insight.domain.model.DailyWeather;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 예보구역별 중기예보 캐시 계약.
 *
 * <p>단기예보 캐시와 같은 이유로 포트로 꺼내 둔다 - 성능이 아니라 쿼터 정책이라
 * application 계층이 눈에 보이게 결정해야 한다.
 *
 * <p>다만 규모가 다르다. 중기예보는 <b>지역 단위</b>라 제주 전체가 키 두 개로 덮이고
 * 발표도 1일 2회뿐이라, 캐시가 없어도 쿼터를 태울 위험이 단기예보보다 훨씬 작다.
 * 그래도 두는 이유는 응답 지연 때문이다 - 일정 브리핑은 일자마다 조회하므로
 * 캐시가 없으면 같은 지역을 여러 번 왕복하게 된다.
 */
public interface MidTermForecastCachePort {

    Optional<CachedMidTermQueryResult> find(MidTermRegion region);

    void put(MidTermRegion region, List<DailyWeather> dailies, LocalDateTime freshUntil, Duration retention);
}
