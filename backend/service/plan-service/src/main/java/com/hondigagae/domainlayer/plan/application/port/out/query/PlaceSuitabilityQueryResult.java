package com.hondigagae.domainlayer.plan.application.port.out.query;

import java.time.LocalDate;
import java.util.List;
import lombok.Builder;

/**
 * tour-service 가 산출한 적합도 결과.
 *
 * <p>이 서비스는 점수를 <b>다시 계산하지 않는다.</b> 판정 규칙의 소유자는 tour-service 이고,
 * 같은 규칙을 두 곳에서 구현하면 일정 화면과 장소 화면이 같은 날 같은 곳을 다르게 말하게 된다.
 * 여기서는 받아서 옮기기만 한다.
 */
@Builder
public record PlaceSuitabilityQueryResult(
    long placeId,
    String placeTitle,
    LocalDate targetDate,
    // null 이면 판단 근거가 없다는 뜻이다. 0 으로 바꾸지 않는다.
    Integer score,
    String levelCode,
    String levelName,
    String levelDescription,
    List<ReasonQueryResult> reasons,
    DailyWeatherQueryResult weather,
    List<AlternativeQueryResult> indoorAlternatives,
    boolean weatherApplied,
    boolean congestionApplied
) {

    public record ReasonQueryResult(String code, String name, String description, int scoreDelta) {

    }

    public record DailyWeatherQueryResult(
        LocalDate date,
        // 단기/중기 구분. 사용자가 신뢰도를 알아야 한다.
        String forecastSourceCode,
        String forecastSourceName,
        Double minTemperature,
        Double maxTemperature,
        Integer maxPrecipitationProbability,
        String precipitationTypeName,
        String skyStateName,
        Double maxWindSpeed,
        Integer maxHumidity
    ) {

    }

    public record AlternativeQueryResult(
        long placeId, String title, double lat, double lng, int distanceMeters
    ) {

    }
}
