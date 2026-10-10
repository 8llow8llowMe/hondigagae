package com.hondigagae.domainlayer.plan.adapter.out.client.feign.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.LocalDate;
import java.util.List;

/**
 * tour-service 적합도 응답의 Feign 전용 표현.
 *
 * <p>{@code score} 가 Wrapper 인 것을 그대로 유지한다. 원천이 null 로 주는 것은
 * "판단 근거 없음"이고, 이쪽에서 0 으로 바꾸면 그 뜻이 사라진다.
 *
 * <p>등급 metadata 는 {@link ScoreMetadataClientResponse} 를 쓴다 — 산책 위험도·골든타임과
 * 같은 스키마라 <b>같은 패키지의 한 벌을 공유한다</b>. 여기에 중첩 레코드로 복제해 두었더니
 * 원천에 칸이 생길 때 한쪽만 고쳐졌다 (#759).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record PlaceSuitabilityClientResponse(
    String placeId,
    String placeTitle,
    LocalDate targetDate,
    Integer score,
    ScoreMetadataClientResponse suitabilityLevel,
    List<ReasonClientResponse> reasons,
    DailyWeatherClientResponse weather,
    List<AlternativeClientResponse> indoorAlternatives,
    boolean weatherApplied,
    boolean congestionApplied
) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ReasonClientResponse(String code, String name, String description, int scoreDelta) {

    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record DailyWeatherClientResponse(
        LocalDate date,
        MetadataClientResponse forecastSource,
        Double minTemperature,
        Double maxTemperature,
        Integer maxPrecipitationProbability,
        MetadataClientResponse precipitationType,
        MetadataClientResponse skyState,
        Double maxWindSpeed,
        Integer maxHumidity,
        Double maxFeelsLikeTemperature
    ) {

    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AlternativeClientResponse(
        String placeId, String title, double lat, double lng, int distanceMeters
    ) {

    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record MetadataClientResponse(String code, String name, String description) {

    }
}
