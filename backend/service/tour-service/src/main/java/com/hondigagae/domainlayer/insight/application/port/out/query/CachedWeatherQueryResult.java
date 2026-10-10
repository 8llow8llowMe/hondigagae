package com.hondigagae.domainlayer.insight.application.port.out.query;

import com.hondigagae.domainlayer.insight.domain.model.WeatherForecast;
import java.time.LocalDateTime;
import java.util.List;
import lombok.Builder;

/**
 * 캐시에서 꺼낸 예보와 그 신선도.
 *
 * <p>신선 여부를 값에 담아 올리는 이유는 external-api-guide §2 의 폴백 순서
 * (캐시 스테일 허용 - 폴백 값 - 도메인 예외) 를 application 이 실제로 <b>결정</b>할 수 있게
 * 하기 위해서다. 단순히 Optional 로만 주면 "낡았지만 있는 값"과 "없는 값"이 구분되지 않아
 * 원천이 죽었을 때 날씨 기능 전체가 멎는다.
 */
@Builder
public record CachedWeatherQueryResult(
    List<WeatherForecast> forecasts,
    // 다음 발표 회차가 올라오는 시각. 이 시각을 지나면 stale 이다.
    LocalDateTime freshUntil,
    boolean stale
) {

}
