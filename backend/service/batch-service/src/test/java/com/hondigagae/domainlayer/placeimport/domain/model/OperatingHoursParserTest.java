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
    @DisplayName("기본 규칙은 요일부 없는 시각 범위를 모름으로 남긴다 — 긴급 시설 openNowOnly 가 이 계약에 기대고 있다")
    void strictRuleLeavesSegmentWithoutDayExpressionUnknown() {
        // openNowOnly 는 "지금 확실히 열린 곳"이라 모름도 뺀다. 여기서 매일로 추론하면
        // 휴무일에 닫힌 동물병원이 "열린 곳"으로 올라온다 (NearbyFacilityQueryProcessor).
        assertThat(OperatingHoursParser.parseWeekly("09:00~18:00")).isNull();
        assertThat(OperatingHoursParser.parseWeekly("09:00~18:00, 입장마감 17:30")).isNull();
    }

    @Test
    @DisplayName("추론 변이는 요일부 없는 시각 범위를 전 요일로 본다 (TourAPI detailIntro2 원문에 흔한 형태)")
    void everyDayVariantCoversSegmentWithoutDayExpression() {
        WeeklySchedule schedule = OperatingHoursParser.parseWeeklyAssumingEveryDay("09:00~18:00");

        assertThat(schedule).isNotNull();
        assertThat(schedule.toSpec()).isEqualTo("1234567:0900-1800");
        assertThat(schedule.isOpenAt(MON_10_00)).isTrue();
        assertThat(schedule.isOpenAt(SUN_14_00)).isTrue();
        assertThat(schedule.isOpenAt(MON_10_00.withHour(20))).isFalse();
    }

    @Test
    @DisplayName("추론 변이에서도 요일부 있는 원문의 해석은 그대로다 — 두 규칙이 갈리는 것은 요일부가 없을 때뿐이다")
    void everyDayVariantKeepsExplicitDayExpressions() {
        String raw = "월~금 09:00~21:00, 토 10:00~22:00";

        assertThat(OperatingHoursParser.parseWeeklyAssumingEveryDay(raw).toSpec())
            .isEqualTo(OperatingHoursParser.parseWeekly(raw).toSpec());
        // 판정 불가 조건부는 추론 변이에서도 버린다
        assertThat(OperatingHoursParser.parseWeeklyAssumingEveryDay("법정공휴일 10:00~17:00")).isNull();
    }

    @Test
    @DisplayName("추론 변이에서 요일부 없는 앞 구간은 뒤 세그먼트를 못 풀어도 살아남는다")
    void unparseableTailDoesNotKillLeadingSegment() {
        WeeklySchedule schedule = OperatingHoursParser.parseWeeklyAssumingEveryDay("09:00~18:00, 입장마감 17:30");

        assertThat(schedule).isNotNull();
        assertThat(schedule.toSpec()).isEqualTo("1234567:0900-1800");
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
