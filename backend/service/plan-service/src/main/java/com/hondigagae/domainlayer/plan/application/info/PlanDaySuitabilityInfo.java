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
 *
 * @param levelScoreDescription 등급 점수 해석 문장. 원천이 주는 값을 그대로 옮긴다 (#759)
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
    String levelScoreDescription,
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

    /**
     * 실내 대안 한 곳. 장소 유형 세 값은 원천 metadata 를 편 것이고 Presenter 가 다시 metadata 로 씌운다.
     * 원천이 유형을 주지 않으면 null 이다 (#1461).
     */
    @Builder
    public record AlternativeInfo(
        long placeId, String title, double lat, double lng, int distanceMeters,
        String contentTypeCode, String contentTypeName, String contentTypeDescription, String sourceCategory
    ) {

    }
}
