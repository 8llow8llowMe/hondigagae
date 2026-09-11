package com.hondigagae.domainlayer.placeimport.domain.model;

import com.hondigagae.shared.travel.schedule.WeeklySchedule;
import java.time.DayOfWeek;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 운영시간 문자열 해석.
 *
 * <p>제주 동물병원 225행의 실제 값을 보고 규칙을 정했다. 운영시간이 "정보없음"인 곳이 절반(111행)이고,
 * 24시간 운영은 3곳뿐이다.
 *
 * <p><b>"연중무휴"를 24시간으로 보지 않는다.</b> 매일 문을 연다는 뜻이지 24시간이라는 뜻이 아니다 —
 * 실제로 "연중무휴"이면서 운영시간이 14:00~20:00인 병원이 있었다.
 */
public final class OperatingHoursParser {

    private static final String UNKNOWN_MARK = "정보없음";
    /** 00:00~24:00 형태만 24시간으로 인정한다. */
    private static final Pattern ALL_DAY_HOURS = Pattern.compile("0?0:00\s*~\s*24:00");
    /** 상호에 "24시"가 들어간 경우. 운영시간이 비어 있어도 이 신호는 신뢰한다. */
    private static final Pattern NAME_24H = Pattern.compile("24\s*시");

    private OperatingHoursParser() {
    }

    /** 원천이 "정보없음"으로 채워 보내는 값을 null 로 바꾼다. 화면에서 "정보 없음"으로 표시하기 위해서다. */
    public static String normalizeHours(String raw) {
        if (raw == null || raw.isBlank() || UNKNOWN_MARK.equals(raw.trim())) {
            return null;
        }
        return raw.trim();
    }

    /**
     * "월~금 09:00~21:00, 토 10:00~22:00" 의 세그먼트 형태. 요일부 + 시각 범위.
     *
     * <p><b>요일부 자리는 비어도 매칭된다</b>({@code (.*?)}). {@code (.+?)} 였을 때는
     * {@code "09:00~18:00"} 에서 최소 한 글자를 먹으려고 {@code "0"} 을 요일부로 잡아,
     * 요일 표기가 없다는 사실이 "요일부가 0 이라 판정 불가"로 흐려졌다. 빈 요일부를 실제로
     * 매일로 볼지는 {@link #parseDays} 가 호출부 의도에 따라 정한다.
     */
    private static final Pattern SEGMENT =
        Pattern.compile("^(.*?)\\s*(\\d{1,2}):(\\d{2})\\s*~\\s*(\\d{1,2}):(\\d{2})$");
    private static final Pattern DAY_RANGE = Pattern.compile("^([월화수목금토일])\\s*~\\s*([월화수목금토일])$");
    private static final Pattern SINGLE_DAY = Pattern.compile("^([월화수목금토일])(요일)?$");
    private static final String DAY_ORDER = "월화수목금토일";

    /**
     * 자유 텍스트 운영시간을 주간 스케줄로 구조화한다. 만들 수 없으면 null.
     *
     * <p>실측 기준 이 형태로 여행 장소 93%, 동물약국 98%, 동물병원 64% 가 풀린다.
     * 해석 규칙:
     * <ul>
     *   <li>콤마로 나뉜 세그먼트를 각각 해석한다. "월~금 09:00~21:00, 토 10:00~22:00"</li>
     *   <li>요일부는 "매일", "월~금", "수~월"(주 넘김), "토"/"일요일" 을 인정한다</li>
     *   <li><b>"법정공휴일 …" 과 "7~9월 …" 같은 조건부 구간은 버린다.</b> 공휴일 달력 없이는
     *       판정할 수 없고, 그날 실제로는 열려 있는데 닫혔다고 말하는 편이 더 나쁘다</li>
     *   <li>해석된 세그먼트가 하나도 없으면 전체를 "모름"으로 남긴다</li>
     * </ul>
     */
    public static WeeklySchedule parseWeekly(String raw) {
        return parseWeekly(raw, false);
    }

    /**
     * 요일 표기 없는 시각 범위({@code "09:00~18:00"})를 <b>매일</b>로 보는 변이.
     *
     * <p>TourAPI {@code detailIntro2} 는 요일부 없이 시각만 주는 경우가 흔해, 엄격 규칙으로는
     * 그 원문이 전부 "모름"으로 남아 수집의 값어치가 사라진다. 휴무일({@code restDate})은 spec 이
     * 원래 반영하지 않으므로 여기서 늘어나는 오차는 기존과 같은 종류다 — 문화정보원의
     * "매일 09:00~18:00" + "매주 화요일 휴무" 조합이 이미 그 상태다.
     *
     * <p><b>이것을 기본값으로 두지 않는 이유</b>는 소비처가 다르기 때문이다. 긴급 시설의
     * {@code openNowOnly} 는 "지금 확실히 열린 곳"만 남기는 <b>하드 필터</b>라 모름도 뺀다 —
     * 급할 때 닫힌 동물병원을 "열린 곳"으로 골라 주는 것은 화면에 잘못 표시하는 것과 성격이
     * 다르다. 추론을 켤지는 그래서 호출부가 고른다.
     */
    public static WeeklySchedule parseWeeklyAssumingEveryDay(String raw) {
        return parseWeekly(raw, true);
    }

    private static WeeklySchedule parseWeekly(String raw, boolean everyDayWhenNoDayExpression) {
        String hours = normalizeHours(raw);
        if (hours == null) {
            return null;
        }
        List<WeeklySchedule.Segment> segments = new ArrayList<>();
        for (String part : hours.split(",")) {
            WeeklySchedule.Segment segment = parseSegment(part.trim(), everyDayWhenNoDayExpression);
            if (segment != null) {
                segments.add(segment);
            }
        }
        return WeeklySchedule.of(segments);
    }

    private static WeeklySchedule.Segment parseSegment(String part, boolean everyDayWhenNoDayExpression) {
        Matcher matcher = SEGMENT.matcher(part);
        if (!matcher.matches()) {
            return null;
        }
        Set<DayOfWeek> days = parseDays(matcher.group(1).trim(), everyDayWhenNoDayExpression);
        if (days == null || days.isEmpty()) {
            return null;
        }
        int open = Integer.parseInt(matcher.group(2)) * 60 + Integer.parseInt(matcher.group(3));
        int close = Integer.parseInt(matcher.group(4)) * 60 + Integer.parseInt(matcher.group(5));
        return new WeeklySchedule.Segment(days, open, close);
    }

    /**
     * 요일부를 요일 집합으로 옮긴다. 판정할 수 없으면 null 이고 그 세그먼트만 버려진다.
     *
     * <p>요일부가 빈 세그먼트({@code "09:00~18:00"})는 {@code everyDayWhenNoDayExpression} 이
     * 참일 때만 전 요일이 된다 ({@link #parseWeeklyAssumingEveryDay} 의 javadoc 이 그 근거다).
     * 거짓이면 다른 판정 불가 요일부와 똑같이 버린다.
     */
    private static Set<DayOfWeek> parseDays(String dayExpression, boolean everyDayWhenNoDayExpression) {
        if (dayExpression.isEmpty()) {
            return everyDayWhenNoDayExpression ? EnumSet.allOf(DayOfWeek.class) : null;
        }
        if (dayExpression.equals("매일")) {
            return EnumSet.allOf(DayOfWeek.class);
        }
        Matcher range = DAY_RANGE.matcher(dayExpression);
        if (range.matches()) {
            int from = DAY_ORDER.indexOf(range.group(1));
            int to = DAY_ORDER.indexOf(range.group(2));
            Set<DayOfWeek> days = EnumSet.noneOf(DayOfWeek.class);
            // "수~월" 처럼 주를 넘기는 범위를 지원한다 — 화요일 휴무 가게가 실제로 이렇게 적는다
            for (int i = from; ; i = (i + 1) % 7) {
                days.add(DayOfWeek.of(i + 1));
                if (i == to) {
                    break;
                }
            }
            return days;
        }
        Matcher single = SINGLE_DAY.matcher(dayExpression);
        if (single.matches()) {
            return EnumSet.of(DayOfWeek.of(DAY_ORDER.indexOf(single.group(1)) + 1));
        }
        // "법정공휴일", "7~9월" 등 판정 불가 조건부 — 이 세그먼트만 버린다
        return null;
    }

    public static boolean isOpen24(String name, String operatingHours) {
        if (name != null && NAME_24H.matcher(name).find()) {
            return true;
        }
        return operatingHours != null && ALL_DAY_HOURS.matcher(operatingHours).find();
    }
}
