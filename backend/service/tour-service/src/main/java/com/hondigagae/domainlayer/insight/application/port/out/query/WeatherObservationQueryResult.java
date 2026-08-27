package com.hondigagae.domainlayer.insight.application.port.out.query;

import com.hondigagae.domainlayer.insight.domain.model.WeatherForecast;
import java.time.LocalDateTime;
import java.util.List;
import lombok.Builder;

/**
 * 원천에서 받아온 예보와 다음 갱신 시점.
 *
 * <p>{@code nextPublishAt} 을 값에 실어 올리는 이유는 캐시 수명을 <b>고정 TTL 이 아니라
 * 원천의 발표 주기</b>에 맞추기 위해서다. 10분 TTL 을 걸면 발표 간격 3시간 동안 같은 데이터를
 * 18번 다시 받아 쿼터만 태운다. 반대로 3시간 고정 TTL 은 발표 직후 갱신을 놓친다.
 *
 * <p>발표 주기를 아는 것은 어댑터(기상청 프로토콜)의 책임이므로 계산은 그쪽에 남기고,
 * application 은 결과만 받아 캐시 정책에 쓴다.
 */
@Builder
public record WeatherObservationQueryResult(
    List<WeatherForecast> forecasts,
    LocalDateTime nextPublishAt
) {

    public boolean isEmpty() {
        return forecasts == null || forecasts.isEmpty();
    }
}
