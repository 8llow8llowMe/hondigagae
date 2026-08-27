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

    /** "월~금 09:00~21:00, 토 10:00~22:00" 의 세그먼트 형태. 요일부 + 시각 범위. */
    private static final Pattern SEGMENT =
        Pattern.compile("^(.+?)\\s*(\\d{1,2}):(\\d{2})\\s*~\\s*(\\d{1,2}):(\\d{2})$");
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
        String hours = normalizeHours(raw);
        if (hours == null) {
            return null;
        }
        List<WeeklySchedule.Segment> segments = new ArrayList<>();
        for (String part : hours.split(",")) {
            WeeklySchedule.Segment segment = parseSegment(part.trim());
            if (segment != null) {
                segments.add(segment);
            }
        }
        return WeeklySchedule.of(segments);
    }

    private static WeeklySchedule.Segment parseSegment(String part) {
        Matcher matcher = SEGMENT.matcher(part);
        if (!matcher.matches()) {
            return null;
        }
        Set<DayOfWeek> days = parseDays(matcher.group(1).trim());
        if (days == null || days.isEmpty()) {
            return null;
        }
        int open = Integer.parseInt(matcher.group(2)) * 60 + Integer.parseInt(matcher.group(3));
        int close = Integer.parseInt(matcher.group(4)) * 60 + Integer.parseInt(matcher.group(5));
        return new WeeklySchedule.Segment(days, open, close);
    }

    private static Set<DayOfWeek> parseDays(String dayExpression) {
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
