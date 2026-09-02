package com.hondigagae.domainlayer.insight.domain.model;

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
    List<SuitabilityReason> reasons
) {

    public boolean isScored() {
        return weatherScore != null;
    }
}
