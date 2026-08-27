package com.hondigagae.domainlayer.insight.application.port.out;

import com.hondigagae.common.geo.KmaGridPoint;
import com.hondigagae.domainlayer.insight.application.port.out.query.CachedWeatherQueryResult;
import com.hondigagae.domainlayer.insight.domain.model.WeatherForecast;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 격자별 예보 캐시 계약.
 *
 * <p>캐시를 어댑터 안에 감추지 않고 포트로 꺼내 둔 이유는, 이것이 성능 최적화가 아니라
 * <b>쿼터 정책</b>이기 때문이다. 공공 API 개발계정은 일 1,000건 제한이 있어 캐시 적중 여부가
 * 기능의 가용성을 좌우한다. 정책은 application 계층이 눈에 보이게 결정해야 한다.
 *
 * <p>키는 장소가 아니라 격자다. 장소 315곳이 같은 격자에 모이면 원천 호출은 한 번이다.
 */
public interface WeatherForecastCachePort {

    /**
     * 캐시 조회. 신선도가 지난 값도 버리지 않고 {@code stale=true} 로 돌려준다 -
     * 원천이 죽었을 때 마지막 방어선이 된다.
     */
    Optional<CachedWeatherQueryResult> find(KmaGridPoint grid);

    /**
     * @param freshUntil 다음 발표 회차가 올라오는 시각. 이 시각까지는 신선한 값으로 본다
     * @param retention  키를 물리적으로 유지할 기간. freshUntil 이후에도 스테일 폴백용으로 남긴다
     */
    void put(KmaGridPoint grid, List<WeatherForecast> forecasts, LocalDateTime freshUntil, Duration retention);
}
