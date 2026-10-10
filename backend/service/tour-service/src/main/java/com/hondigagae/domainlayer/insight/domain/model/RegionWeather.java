package com.hondigagae.domainlayer.insight.domain.model;

import com.hondigagae.domainlayer.insight.domain.enums.ForecastCoverage;
import com.hondigagae.domainlayer.insight.domain.enums.JejuRegion;
import java.time.LocalDate;
import java.util.List;
import lombok.Builder;

/**
 * 한 권역의 하루 날씨와 그 날씨만으로 매긴 점수.
 *
 * <p>점수는 {@link SuitabilityEvaluator#applyWeatherRules} 가 낸 감점을 100 에서 뺀 값이다.
 * 장소 적합도와 <b>같은 규칙</b>을 쓰되 장소·혼잡도 항목이 없으므로 값의 뜻이 다르다 -
 * 이것은 "이 권역이 나가기 좋은가"이지 "이 장소가 갈 만한가"가 아니다.
 */
@Builder
public record RegionWeather(
    JejuRegion region,
    LocalDate date,
    DailyWeather weather,
    // 날씨만으로 매긴 점수(0~100). 근거가 없으면 null 이다.
    Integer weatherScore,
    // 점수가 없을 때 그 이유. 비교 전체를 실패로 볼지 여기서 갈린다
    ForecastCoverage coverage,
    List<SuitabilityReason> reasons
) {

    public boolean isScored() {
        return weatherScore != null;
    }

    /**
     * 이 권역을 못 판정한 것이 <b>장애</b>인지.
     *
     * <p>예보 시간대가 지난 것(밤)은 장애가 아니다. 그것까지 실패로 세면 비교 API 가
     * 밤마다 5xx 를 낸다.
     */
    public boolean isFailure() {
        return coverage != null && coverage.isFailure();
    }
}
