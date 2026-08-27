package com.hondigagae.domainlayer.insight.application.port.out.query;

import com.hondigagae.domainlayer.insight.domain.model.DailyWeather;
import java.time.LocalDateTime;
import java.util.List;
import lombok.Builder;

/**
 * 캐시에서 꺼낸 중기예보와 그 신선도.
 *
 * <p>{@link CachedWeatherQueryResult} 와 같은 이유로 신선 여부를 값에 담는다 -
 * "낡았지만 있는 값"과 "없는 값"이 구분되어야 원천이 죽었을 때 폴백할 수 있다.
 */
@Builder
public record CachedMidTermQueryResult(
    List<DailyWeather> dailies,
    LocalDateTime freshUntil,
    boolean stale
) {

}
