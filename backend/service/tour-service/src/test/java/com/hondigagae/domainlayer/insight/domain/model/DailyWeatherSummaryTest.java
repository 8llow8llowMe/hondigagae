package com.hondigagae.domainlayer.insight.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.insight.domain.enums.PrecipitationType;
import com.hondigagae.domainlayer.insight.domain.enums.SkyState;
import com.hondigagae.shared.travel.insight.ForecastSource;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 하루 요약의 온전함 판정.
 *
 * <p><b>실측에서 나온 문제다.</b> 2026-08-27 14시 발표를 받아 보니 5일치가 오는데 날짜별
 * 시각 수가 9 / 24 / 24 / 8 / <b>1</b> 이었다. 마지막 날은 자정 한 시각뿐이다.
 *
 * <p>그것으로 하루를 접으면 "최고기온 = 자정 기온" 이 되어, 근거가 거의 없는데도 그럴듯한
 * 점수가 나온다. 예외도 경고도 없이 조용히 틀리는 종류라 테스트로 못박는다.
 */
class DailyWeatherSummaryTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 8, 27);

    @Test
    @DisplayName("자정 한 시각뿐인 미래 날짜는 하루 요약으로 쓰지 않는다")
    void rejectsFutureDayWithOnlyMidnightReading() {
        // 실측된 마지막 날의 모양 그대로다.
        DailyWeather lastDay = shortTermDay(TODAY.plusDays(4), List.of(0));

        assertThat(lastDay.hasDaySummary(TODAY)).isFalse();
    }

    @Test
    @DisplayName("3시간 간격으로 낮까지 덮인 미래 날짜는 쓴다")
    void acceptsFutureDayWithAfternoonCoverage() {
        // 실측 8/30 의 모양: 00, 03, 06, 09, 12, 15, 18, 21시
        DailyWeather day = shortTermDay(TODAY.plusDays(3), List.of(0, 3, 6, 9, 12, 15, 18, 21));

        assertThat(day.hasDaySummary(TODAY)).isTrue();
    }

    @Test
    @DisplayName("시각이 많아도 낮 데이터가 없으면 쓰지 않는다 - 최고기온을 놓친다")
    void rejectsFutureDayWithoutAfternoon() {
        DailyWeather dawnOnly = shortTermDay(TODAY.plusDays(2), List.of(0, 3, 6, 9));

        assertThat(dawnOnly.hasDaySummary(TODAY)).isFalse();
    }

    @Test
    @DisplayName("오늘은 남은 시각이 하나라도 있으면 쓴다 - 지나간 시간이 없는 것이 정상이다")
    void acceptsTodayEvenWhenPartial() {
        DailyWeather lateEvening = shortTermDay(TODAY, List.of(23));

        assertThat(lateEvening.hasDaySummary(TODAY)).isTrue();
    }

    @Test
    @DisplayName("중기예보는 시각별 데이터가 없어도 쓴다 - 최고/최저기온을 원천이 직접 준다")
    void acceptsMidTermWithoutHourly() {
        DailyWeather midTerm = DailyWeather.builder()
            .date(TODAY.plusDays(7))
            .source(ForecastSource.MID_TERM)
            .minTemperature(25.0d).maxTemperature(31.0d)
            .maxPrecipitationProbability(30)
            .worstPrecipitationType(PrecipitationType.NONE)
            .representativeSkyState(SkyState.MOSTLY_CLOUDY)
            .hourly(List.of())
            .build();

        assertThat(midTerm.hasDaySummary(TODAY)).isTrue();
        // 다만 시각 단위 판정(산책 위험도)은 불가능하다.
        assertThat(midTerm.supportsHourlyJudgement()).isFalse();
    }

    @Test
    @DisplayName("시각별 예보가 아예 없는 단기예보는 쓰지 않는다")
    void rejectsEmptyShortTermDay() {
        DailyWeather empty = shortTermDay(TODAY.plusDays(1), List.of());

        assertThat(empty.hasDaySummary(TODAY)).isFalse();
    }

    /** 주어진 시각들만 담긴 단기예보 하루를 만든다. */
    private static DailyWeather shortTermDay(LocalDate date, List<Integer> hours) {
        List<WeatherForecast> hourly = new ArrayList<>();
        for (int hour : hours) {
            hourly.add(WeatherForecast.builder()
                .nx(53).ny(38)
                .forecastAt(date.atTime(hour, 0))
                .baseAt(date.atTime(2, 0))
                .temperature(26.0d)
                .precipitationProbability(20)
                .precipitationType(PrecipitationType.NONE)
                .skyState(SkyState.CLEAR)
                .precipitation(PrecipitationAmount.none())
                .build());
        }
        return DailyWeather.builder()
            .date(date)
            .source(ForecastSource.SHORT_TERM)
            .hourly(hourly)
            .build();
    }
}
