package com.hondigagae.domainlayer.insight.application.info;

import com.hondigagae.domainlayer.insight.domain.model.CongestionSnapshot;
import com.hondigagae.domainlayer.insight.domain.model.DailyWeather;
import com.hondigagae.domainlayer.insight.domain.model.WeatherWarning;
import com.hondigagae.domainlayer.insight.domain.model.SuitabilityScore;
import java.time.LocalDate;
import java.util.List;
import lombok.Builder;

/**
 * 적합도 응답 조립에 필요한 것 전부.
 *
 * <p>{@code weather} 와 {@code congestion} 을 점수와 함께 내리는 이유는 XAI 규약 때문이다.
 * 점수만 주면 사용자는 그것을 믿거나 말거나밖에 못 한다. 근거로 쓴 실제 수치를 같이 보여야
 * "왜 82점인지"를 확인할 수 있다.
 */
@Builder
public record PlaceSuitabilityInfo(
    long placeId,
    String placeTitle,
    LocalDate targetDate,
    SuitabilityScore score,
    // 근거로 쓴 그 날의 날씨. 판정 불가일 때는 null 이다.
    DailyWeather weather,
    CongestionSnapshot congestion,
    // 발효 중인 가장 무거운 특보. 없거나 조회 실패면 null 이다.
    WeatherWarning weatherWarning,
    // 비 예보일 때만 채운다. 비가 안 오면 빈 목록이다.
    List<AlternativePlaceInfo> indoorAlternatives,
    boolean petConditionApplied
) {

}
