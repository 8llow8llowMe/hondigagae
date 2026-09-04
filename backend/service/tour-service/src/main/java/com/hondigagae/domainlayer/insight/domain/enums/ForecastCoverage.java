package com.hondigagae.domainlayer.insight.domain.enums;

import com.hondigagae.common.dto.metadata.CodeNameDescribable;
import java.time.LocalDate;
import java.util.Collection;
import java.util.Collections;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 그 날짜의 예보를 쓸 수 있는지, 못 쓴다면 왜인지.
 *
 * <p><b>"예보가 없다"에는 성질이 다른 세 가지가 섞여 있다.</b> 셋을 뭉뚱그리면 사용자에게
 * 하는 말이 틀린다 - 늦은 밤에 "예보 범위 밖"이라고 하거나, 정상 상태를 장애라고 하게 된다.
 *
 * <ul>
 *   <li>{@link #DAY_ENDED} — 그 날짜의 예보 시간대가 이미 지났다. <b>정상 상태이고 밤마다
 *       일어난다.</b> 기상청 단기예보 23시 회차는 자기 발표일 행을 하나도 주지 않기 때문이다
 *       (실측: {@code base_date=20260903&base_time=2300} 의 최초 예보가 20260904 0000).
 *       재시도해도 자정 전에는 풀리지 않는다</li>
 *   <li>{@link #OUT_OF_RANGE} — 예보가 아직 닿지 않는 미래다. 기다릴 일이다</li>
 *   <li>{@link #UNAVAILABLE} — 예보 목록 자체를 못 받았다. <b>이것만 장애다</b></li>
 * </ul>
 *
 * <p>이 enum 은 날짜만 다룬다. {@code WeatherForecast}/{@code DailyWeather} 에 얇은 위임
 * 메서드를 두어 호출부가 목록을 그대로 넘기게 하되, 판정 규칙은 여기 한 곳에만 둔다 -
 * 화면마다 따로 판단하면 같은 시각에 어떤 화면은 "예보 없음", 어떤 화면은 "장애"라고 말한다.
 */
@Getter
@RequiredArgsConstructor
public enum ForecastCoverage implements CodeNameDescribable {

    AVAILABLE("예보 있음", "그 날짜의 예보가 있어 날씨를 근거로 씁니다."),
    DAY_ENDED("남은 예보 없음",
        "그 날짜의 예보 시간대가 이미 지났습니다. 기상청 23시 발표부터는 다음 날 예보만 제공됩니다."),
    OUT_OF_RANGE("예보 범위 밖", "예보가 아직 닿지 않는 날짜입니다."),
    UNAVAILABLE("날씨 정보 없음", "날씨 정보를 가져오지 못했습니다.");

    private final String displayName;
    private final String description;

    /**
     * 덮고 있는 날짜들을 놓고 대상 날짜의 커버리지를 가른다.
     *
     * <p>대상이 <b>가장 이른 날짜보다 앞이면</b> 지난 것이고, 뒤면 아직 안 온 것이다.
     * 목록의 중간이 비어 있을 일은 원천 특성상 없다 - 있어도 {@code OUT_OF_RANGE} 로 접히는데,
     * 그때는 실제로 기다릴 일이 맞다.
     *
     * @param coveredDates 예보가 덮는 날짜들. 비어 있으면 목록 자체를 못 받은 것이다
     */
    public static ForecastCoverage of(LocalDate target, Collection<LocalDate> coveredDates) {
        if (coveredDates == null || coveredDates.isEmpty()) {
            return UNAVAILABLE;
        }
        if (coveredDates.contains(target)) {
            return AVAILABLE;
        }
        return target.isBefore(Collections.min(coveredDates)) ? DAY_ENDED : OUT_OF_RANGE;
    }

    /** 예보를 근거로 쓸 수 있는지. */
    public boolean isUsable() {
        return this == AVAILABLE;
    }

    /**
     * 재시도가 의미 있는 상태인지.
     *
     * <p>이 값이 false 인데 5xx 를 내면 클라이언트는 풀리지 않을 것을 계속 두드린다.
     */
    public boolean isFailure() {
        return this == UNAVAILABLE;
    }
}
