package com.hondigagae.domainlayer.insight.application.port.out.query;

import com.hondigagae.domainlayer.insight.domain.model.DailyWeather;
import java.time.LocalDateTime;
import java.util.List;
import lombok.Builder;

/**
 * 중기예보 조회 결과.
 *
 * <p>{@code nextPublishAt} 을 함께 올리는 이유는 단기예보와 같다 - 캐시 수명을 고정 TTL 이
 * 아니라 원천의 발표 주기에 맞추기 위해서다. 중기예보는 1일 2회(06, 18시)라 단기예보(8회)와
 * 주기가 다르고, 발표 주기를 아는 것은 어댑터의 책임이다.
 */
@Builder
public record MidTermForecastQueryResult(
    List<DailyWeather> dailies,
    LocalDateTime nextPublishAt
) {

    public boolean isEmpty() {
        return dailies == null || dailies.isEmpty();
    }
}
