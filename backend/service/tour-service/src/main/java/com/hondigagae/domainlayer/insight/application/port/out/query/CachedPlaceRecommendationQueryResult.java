package com.hondigagae.domainlayer.insight.application.port.out.query;

import com.hondigagae.domainlayer.insight.domain.model.CongestionSnapshot;
import com.hondigagae.domainlayer.insight.domain.model.DailyWeather;
import com.hondigagae.domainlayer.insight.domain.model.SuitabilityScore;
import com.hondigagae.domainlayer.insight.domain.model.WeatherWarning;
import com.hondigagae.shared.travel.place.AllowedPetSize;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import java.time.LocalDate;
import java.util.List;

/**
 * 캐시에 둔 장소 추천 결과 (#1368).
 *
 * <p>모양은 {@code PlaceRecommendationInfo} 와 같다. 그래도 따로 두는 이유는 {@code Info} 를 포트 밖으로 내보내지 않는
 * 규칙(architecture-guide §4) 때문이다 — 변환은 {@code InsightMapper} 가 이름대로 한다. 이 값은 JSON 으로 직렬화되므로
 * 필드 타입을 바꾸면 이전 형식의 캐시 항목은 읽기 실패 → 캐시 미스가 된다(TTL 이 짧아 곧 사라진다).
 *
 * <p><b>필드를 더하는 것은 키를 바꾸지 않는다.</b> 서비스 ObjectMapper(Spring Boot)는 없는 칸을 null 로 읽어, 옛 항목은 새 칸만
 * 비운 채 읽힌다. 실내 대안의 {@code contentTypeId} · {@code sourceCategory}(#1461)가 그렇다 — 배포 직후 최대 TTL(600초) 동안
 * 일부 응답의 두 칸이 null 이고, 둘 다 원래 nullable 이라 "모름" 으로 읽힌다. 옛 값이 null 이면 틀린 답이 되는 칸을 더할 때는
 * 키를 바꾼다.
 */
public record CachedPlaceRecommendationQueryResult(
    LocalDate targetDate,
    WeatherWarning weatherWarning,
    List<Place> places
) {

    public record Place(
        long placeId,
        String contentTypeId,
        String title,
        String addr1,
        String sigunguCode,
        Double lat,
        Double lng,
        String firstImage,
        String firstImage2,
        PetAllowanceType petAllowanceType,
        Integer maxPetWeightKg,
        Boolean indoor,
        SuitabilityScore score,
        String headline,
        DailyWeather weather,
        CongestionSnapshot congestion,
        List<Alternative> indoorAlternatives,
        boolean petConditionApplied
    ) {

    }

    public record Alternative(
        long placeId,
        String title,
        double lat,
        double lng,
        int distanceMeters,
        PetAllowanceType petAllowanceType,
        AllowedPetSize allowedPetSize,
        // #1461 에서 더한 칸. 그 전에 쓴 항목은 null 로 읽힌다 — 키를 바꾸지 않은 이유는 위 javadoc.
        String contentTypeId,
        String sourceCategory
    ) {

    }
}
