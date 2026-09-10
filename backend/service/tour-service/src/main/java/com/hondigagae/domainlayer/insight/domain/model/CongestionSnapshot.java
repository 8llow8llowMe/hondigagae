package com.hondigagae.domainlayer.insight.domain.model;

import com.hondigagae.domainlayer.insight.domain.enums.CongestionLevel;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
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

    /**
     * 기간 중 가장 덜 붐비는 날. "언제 덜 붐비나"가 범위 조회의 답이라 여기서 고른다 -
     * 화면·다른 호출부가 각자 고르면 같은 기간에 다른 날을 추천하게 된다 (#425).
     *
     * <p>UNKNOWN 은 후보가 아니다 - 데이터 없음은 한산함이 아니다. 동률이면 <b>가장 이른
     * 날짜</b>를 준다(같은 값이면 가까운 날이 더 쓸모 있다). 아는 날이 하나도 없으면 비운다.
     */
    public static Optional<CongestionSnapshot> leastCrowded(List<CongestionSnapshot> snapshots) {
        if (snapshots == null) {
            return Optional.empty();
        }
        return snapshots.stream()
            .filter(CongestionSnapshot::isKnown)
            .filter(snapshot -> snapshot.concentrationRate() != null)
            .min(Comparator.comparingDouble(CongestionSnapshot::concentrationRate)
                .thenComparing(CongestionSnapshot::date));
    }
}
