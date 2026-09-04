package com.hondigagae.domainlayer.plan.application.info;

import java.time.LocalDate;
import java.util.List;
import lombok.Builder;

/**
 * 하루치 적합도의 application 표현.
 *
 * <p>out-port 의 {@code PlaceSuitabilityQueryResult} 와 모양이 같지만 따로 두는 이유는
 * 경계다 — QueryResult 는 어댑터 계약이라 Presenter 까지 번지면 tour-service 응답
 * 스키마 변화가 곧바로 화면 조립 코드를 흔든다 (architecture-guide §4).
 * 변환은 {@code PlanWeatherProcessor} 가 한다.
 */
@Builder
public record PlanDaySuitabilityInfo(
    long placeId,
    String placeTitle,
    LocalDate targetDate,
    // null 이면 판단 근거가 없다는 뜻이다. 0 으로 바꾸지 않는다.
    Integer score,
    String levelCode,
    String levelName,
    String levelDescription,
    List<ReasonInfo> reasons,
    DailyWeatherInfo weather,
    List<AlternativeInfo> indoorAlternatives,
    boolean weatherApplied,
    boolean congestionApplied
) {

    @Builder
    public record ReasonInfo(String code, String name, String description, int scoreDelta) {

    }

    @Builder
    public record DailyWeatherInfo(
        LocalDate date,
        String forecastSourceCode,
        String forecastSourceName,
        Double minTemperature,
        Double maxTemperature,
        Integer maxPrecipitationProbability,
        String precipitationTypeName,
        String skyStateName,
        Double maxWindSpeed,
        Integer maxHumidity,
        Double maxFeelsLikeTemperature
    ) {

    }

    @Builder
    public record AlternativeInfo(long placeId, String title, double lat, double lng, int distanceMeters) {

    }
}
