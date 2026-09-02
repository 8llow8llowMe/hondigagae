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
    // 가장 나은 권역. 점수가 매겨진 권역이 없으면 null 이다.
    RegionWeather recommended
) {

    /**
     * 점수가 가장 높은 권역을 고른다.
     *
     * <p>동점이면 {@link com.hondigagae.domainlayer.insight.domain.enums.JejuRegion} 선언 순서로
     * 앞선 쪽을 쓴다. 무작위로 흔들리면 같은 조건에서 화면이 매번 다른 곳을 추천하게 된다.
     */
    public static RegionalWeatherComparison of(LocalDate date, List<RegionWeather> regions) {
        Optional<RegionWeather> best = regions.stream()
            .filter(RegionWeather::isScored)
            .max(Comparator.comparingInt(RegionWeather::weatherScore)
                .thenComparing(Comparator.comparing((RegionWeather region) -> region.region().ordinal()).reversed()));

        return RegionalWeatherComparison.builder()
            .date(date)
            .regions(regions)
            .recommended(best.orElse(null))
            .build();
    }
}
