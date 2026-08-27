package com.hondigagae.domainlayer.placeimport.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.shared.travel.schedule.WeeklySchedule;
import java.time.LocalDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 주간 스케줄 구조화 검증. 원문 예시는 전부 문화정보원 제주 CSV 에 실재하는 값이다.
 * 실측 기준 이 규칙으로 여행 장소 93%, 동물약국 98%, 동물병원 64% 가 풀린다.
 */
class OperatingHoursParserTest {

    // 2026-08-31 은 월요일이다
    private static final LocalDateTime MON_10_00 = LocalDateTime.of(2026, 8, 31, 10, 0);
    private static final LocalDateTime TUE_10_00 = LocalDateTime.of(2026, 9, 1, 10, 0);
    private static final LocalDateTime SUN_14_00 = LocalDateTime.of(2026, 9, 6, 14, 0);

    @Test
    @DisplayName("요일 범위 + 개별 요일 + 여러 세그먼트를 해석한다 (가까운약국 원문)")
    void parseDayRangesAndSingles() {
        WeeklySchedule schedule = OperatingHoursParser.parseWeekly(
            "월~금 09:00~22:00, 토 10:00~22:00, 일 13:00~22:00, 법정공휴일 13:00~22:00");

        assertThat(schedule).isNotNull();
        assertThat(schedule.isOpenAt(MON_10_00)).isTrue();
        assertThat(schedule.isOpenAt(SUN_14_00)).isTrue();      // 일 13:00 시작
        assertThat(schedule.isOpenAt(SUN_14_00.minusHours(2))).isFalse();
    }

    @Test
    @DisplayName("주를 넘기는 요일 범위를 지원한다 — 화요일 휴무 가게가 수~월로 적는다 (개다방 원문)")
    void dayRangeWrapsAcrossWeek() {
        WeeklySchedule schedule = OperatingHoursParser.parseWeekly("수~월 10:00~18:00");

        assertThat(schedule.isOpenAt(MON_10_00)).isTrue();
        assertThat(schedule.isOpenAt(TUE_10_00)).isFalse();     // 화요일만 빠진다
    }

    @Test
    @DisplayName("판정할 수 없는 조건부 구간은 버리고 나머지는 살린다 (감귤박물관 원문)")
    void conditionalSegmentsAreDroppedNotFatal() {
        // "7~9월 09:00~19:00" 은 월 조건이라 버리지만 "매일 09:00~18:00" 은 살아야 한다
        WeeklySchedule schedule = OperatingHoursParser.parseWeekly("매일 09:00~18:00, 7~9월 09:00~19:00");

        assertThat(schedule).isNotNull();
        assertThat(schedule.isOpenAt(MON_10_00)).isTrue();
        assertThat(schedule.isOpenAt(MON_10_00.withHour(18).withMinute(30))).isFalse();
    }

    @Test
    @DisplayName("정보없음과 형식 밖 원문은 null — 모름을 닫힘으로 표시하지 않기 위해서다")
    void unparseableReturnsNull() {
        assertThat(OperatingHoursParser.parseWeekly("정보없음")).isNull();
        assertThat(OperatingHoursParser.parseWeekly(null)).isNull();
        assertThat(OperatingHoursParser.parseWeekly("전화 문의")).isNull();
    }

    @Test
    @DisplayName("24시간 표기와 자정 넘김 영업을 해석한다")
    void fullDayAndOvernight() {
        WeeklySchedule allDay = OperatingHoursParser.parseWeekly("매일 00:00~24:00");
        assertThat(allDay.isOpenAt(MON_10_00.withHour(3))).isTrue();

        // 위플레이독 원문 — 15시에 열어 다음날 11시까지
        WeeklySchedule overnight = OperatingHoursParser.parseWeekly("매일 15:00~11:00");
        assertThat(overnight.isOpenAt(MON_10_00.withHour(2))).isTrue();
        assertThat(overnight.isOpenAt(MON_10_00.withHour(13))).isFalse();
    }
}
