package com.hondigagae.domainlayer.insight.domain.model;

import com.hondigagae.domainlayer.insight.domain.enums.CongestionLevel;
import java.time.LocalDate;

/**
 * 특정 날짜의 혼잡도 예측 한 건.
 *
 * <p>날씨와 커버리지가 다르다는 점이 이 값의 핵심이다. 단기예보는 3일까지지만 집중률 예측은
 * 30일 rolling 이라, <b>날씨는 없고 혼잡도만 있는 날짜</b>가 흔하다. 두 근거를 하나로 묶어
 * 점수를 내면 그 차이가 감춰지므로 각각의 유무를 응답에 그대로 드러낸다.
 */
public record CongestionSnapshot(LocalDate date, Double concentrationRate, CongestionLevel level) {

    public static CongestionSnapshot unknown(LocalDate date) {
        return new CongestionSnapshot(date, null, CongestionLevel.UNKNOWN);
    }

    public static CongestionSnapshot of(LocalDate date, Double concentrationRate) {
        return new CongestionSnapshot(date, concentrationRate, CongestionLevel.from(concentrationRate));
    }

    public boolean isKnown() {
        return level != null && level.isKnown();
    }
}
