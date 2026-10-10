package com.hondigagae.domainlayer.insight.domain.model;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import lombok.Builder;

/**
 * 권역들을 나란히 놓고 하나를 고른 결과.
 *
 * <p><b>추천이 비어 있을 수 있다.</b> 모든 권역의 예보를 못 받았거나, 점수가 나온 권역이
 * 하나도 없으면 고르지 않는다. "그나마 나은 곳"을 억지로 지목하면 근거 없는 추천이 된다.
 */
@Builder
public record RegionalWeatherComparison(
    LocalDate date,
    List<RegionWeather> regions,
    // 가장 나은 권역. 고를 수 없으면 null 이다.
    RegionWeather recommended,
    // 제주에 발효 중인 가장 무거운 특보. 없으면 null 이다.
    WeatherWarning weatherWarning
) {

    /**
     * 점수가 가장 높은 권역을 고른다.
     *
     * <p>동점이면 {@link com.hondigagae.domainlayer.insight.domain.enums.JejuRegion} 선언 순서로
     * 앞선 쪽을 쓴다. 무작위로 흔들리면 같은 조건에서 화면이 매번 다른 곳을 추천하게 된다.
     *
     * <p><b>특보 경보 중에는 아무 권역도 고르지 않는다.</b> 특보는 섬 전체에 걸리므로 권역
     * 순위 자체는 여전히 매길 수 있지만, 그때 "여기가 제일 낫다"고 말하면 적합도는 0점,
     * 산책은 위험이라고 하는 같은 서비스가 한쪽에서만 나가라고 하는 셈이 된다.
     * 비교표는 그대로 준다 - 어디가 덜 나쁜지는 여전히 정보다.
     */
    public static RegionalWeatherComparison of(
        LocalDate date, List<RegionWeather> regions, WeatherWarning warning
    ) {
        Optional<RegionWeather> best = WeatherWarning.suppressesRecommendation(warning)
            ? Optional.empty()
            : regions.stream()
                .filter(RegionWeather::isScored)
                .max(Comparator.comparingInt(RegionWeather::weatherScore)
                    .thenComparing(Comparator.comparing((RegionWeather region) -> region.region().ordinal()).reversed()));

        return RegionalWeatherComparison.builder()
            .date(date)
            .regions(regions)
            .recommended(best.orElse(null))
            .weatherWarning(warning)
            .build();
    }
}
