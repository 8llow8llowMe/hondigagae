package com.hondigagae.domainlayer.insight.application.port.out;

import com.hondigagae.domainlayer.insight.domain.model.WeatherWarning;
import java.time.Duration;
import java.util.List;
import java.util.Optional;

/**
 * 기상특보 캐시 계약.
 *
 * <p>예보 캐시와 달리 <b>신선/스테일 구분이 없다.</b> 예보는 낡은 값이라도 없는 것보다 나아
 * 스테일 폴백을 두지만, 특보는 그렇지 않다 - 이미 해제된 태풍경보를 계속 보여 주면
 * 사용자가 멀쩡한 날 일정을 취소한다. TTL 이 지나면 그냥 없는 것으로 본다.
 *
 * <p>빈 목록도 캐시한다. 특보가 없는 것이 압도적으로 흔한 상태라, 그때마다 원천을 부르면
 * 캐시가 사실상 없는 것과 같아진다. 그래서 {@code Optional} 이 감싸는 것은 "값의 유무"가
 * 아니라 <b>"캐시 항목의 유무"</b> 다.
 */
public interface WeatherWarningCachePort {

    Optional<List<WeatherWarning>> find(String stationId);

    void put(String stationId, List<WeatherWarning> warnings, Duration ttl);
}
