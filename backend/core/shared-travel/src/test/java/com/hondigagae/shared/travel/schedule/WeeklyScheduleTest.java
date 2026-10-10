package com.hondigagae.shared.travel.schedule;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class WeeklyScheduleTest {

    // 2026-08-31 은 월요일이다
    private static final LocalDateTime MON_10_00 = LocalDateTime.of(2026, 8, 31, 10, 0);
    private static final LocalDateTime MON_22_00 = LocalDateTime.of(2026, 8, 31, 22, 0);
    private static final LocalDateTime TUE_02_00 = LocalDateTime.of(2026, 9, 1, 2, 0);
    private static final LocalDateTime SAT_10_00 = LocalDateTime.of(2026, 9, 5, 10, 0);

    @Test
    @DisplayName("spec 은 파싱과 직렬화가 왕복한다 — 배치가 쓰고 조회가 읽는 계약이다")
    void specRoundTrips() {
        String spec = "12345:0900-2100;6:1000-2200";
        assertThat(WeeklySchedule.parseSpec(spec).toSpec()).isEqualTo(spec);
    }

    @Test
    @DisplayName("요일과 시각으로 영업 여부를 판정한다")
    void isOpenAtBasics() {
        WeeklySchedule schedule = WeeklySchedule.parseSpec("12345:0900-2100;6:1000-2200");

        assertThat(schedule.isOpenAt(MON_10_00)).isTrue();
        assertThat(schedule.isOpenAt(MON_22_00)).isFalse();   // 평일 21시 마감
        assertThat(schedule.isOpenAt(SAT_10_00)).isTrue();    // 토요일은 10시 시작
        assertThat(schedule.isOpenAt(SAT_10_00.minusHours(1))).isFalse();
    }

    @Test
    @DisplayName("0000-2400 은 그 요일 내내 열려 있다")
    void fullDay() {
        WeeklySchedule schedule = WeeklySchedule.parseSpec("1234567:0000-2400");
        assertThat(schedule.isOpenAt(MON_10_00)).isTrue();
        assertThat(schedule.isOpenAt(TUE_02_00)).isTrue();
    }

    @Test
    @DisplayName("종료가 시작보다 앞서면 자정을 넘긴 영업이다 — 전날 시작한 영업이 새벽까지 이어진다")
    void overnightWrapsPastMidnight() {
        // 매일 15:00~11:00 — 실제 데이터에 있는 형태다
        WeeklySchedule schedule = WeeklySchedule.parseSpec("1234567:1500-1100");

        assertThat(schedule.isOpenAt(MON_22_00)).isTrue();   // 당일 저녁
        assertThat(schedule.isOpenAt(TUE_02_00)).isTrue();   // 월요일 영업이 화요일 새벽까지
        assertThat(schedule.isOpenAt(MON_10_00)).isTrue();   // 일요일 영업의 월요일 오전 꼬리
        assertThat(schedule.isOpenAt(LocalDateTime.of(2026, 8, 31, 13, 0))).isFalse(); // 11~15시 휴식
    }

    @Test
    @DisplayName("깨진 spec 은 예외가 아니라 null — 판정을 모름으로 남긴다")
    void brokenSpecReturnsNull() {
        assertThat(WeeklySchedule.parseSpec(null)).isNull();
        assertThat(WeeklySchedule.parseSpec("")).isNull();
        assertThat(WeeklySchedule.parseSpec("낡은형식")).isNull();
        assertThat(WeeklySchedule.parseSpec("8:0900-1800")).isNull();   // 없는 요일
        assertThat(WeeklySchedule.parseSpec("1:9시-18시")).isNull();
    }

    @Test
    @DisplayName("세그먼트가 없으면 스케줄 자체가 없다")
    void emptySegmentsMeanNoSchedule() {
        assertThat(WeeklySchedule.of(List.of())).isNull();
        assertThat(WeeklySchedule.of(null)).isNull();
        assertThat(WeeklySchedule.of(List.of(
            new WeeklySchedule.Segment(EnumSet.of(DayOfWeek.MONDAY), 540, 1080)))).isNotNull();
    }
}
