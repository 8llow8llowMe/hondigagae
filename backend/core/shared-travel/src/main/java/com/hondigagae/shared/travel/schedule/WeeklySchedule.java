package com.hondigagae.shared.travel.schedule;

import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

/**
 * 요일별 영업시간.
 *
 * <p>원천의 자유 텍스트("월~금 09:00~21:00, 토 10:00~22:00")를 배치가 구조화해 저장하고,
 * 조회 서비스가 "지금 영업 중인가"를 판정하는 데 쓴다. 저장 형식(spec)이 배치와 조회를
 * 가로지르는 계약이라 테이블 스키마와 같은 결로 shared-travel 에 둔다.
 *
 * <p><b>spec 형식</b>: {@code "12345:0900-2100;6:1000-2200"} — 세그먼트를 {@code ;} 로 잇고,
 * 각 세그먼트는 ISO 요일 숫자(1=월 … 7=일)의 나열, {@code :}, 시작-종료(HHMM)다.
 * 24시간은 {@code 0000-2400}. 종료가 시작보다 앞서면 자정을 넘긴다({@code 1500-1100}).
 *
 * <p>판정은 보수적이다 — spec 을 만들 수 없는 원문은 저장하지 않고, 판정 결과도
 * "모름"(null)으로 남긴다. 급할 때 쓰는 데이터라 "열려 있다"는 근거 없이 말하면 안 된다.
 */
public final class WeeklySchedule {

    private static final int MINUTES_PER_DAY = 24 * 60;

    /** 한 세그먼트: 요일 집합 + 분 단위 시작·종료. 종료 {@code <=} 시작이면 자정을 넘긴다. */
    public record Segment(Set<DayOfWeek> days, int openMinute, int closeMinute) {

        public Segment {
            days = Set.copyOf(days);
        }

        boolean coversAt(DayOfWeek day, int minuteOfDay) {
            boolean overnight = closeMinute <= openMinute;
            if (!overnight) {
                return days.contains(day) && minuteOfDay >= openMinute && minuteOfDay < closeMinute;
            }
            if (days.contains(day) && minuteOfDay >= openMinute) {
                return true;
            }
            // 자정을 넘긴 구간 — 전날 시작한 영업이 아직 이어지는 시간대
            return days.contains(day.minus(1)) && minuteOfDay < closeMinute;
        }
    }

    private final List<Segment> segments;

    private WeeklySchedule(List<Segment> segments) {
        this.segments = List.copyOf(segments);
    }

    public static WeeklySchedule of(List<Segment> segments) {
        if (segments == null || segments.isEmpty()) {
            return null;
        }
        return new WeeklySchedule(segments);
    }

    /** spec 문자열에서 복원한다. 형식이 깨져 있으면 null — 판정을 "모름"으로 남기기 위해서다. */
    public static WeeklySchedule parseSpec(String spec) {
        if (spec == null || spec.isBlank()) {
            return null;
        }
        try {
            List<Segment> segments = new ArrayList<>();
            for (String part : spec.split(";")) {
                String[] halves = part.split(":");
                if (halves.length != 2) {
                    return null;
                }
                Set<DayOfWeek> days = EnumSet.noneOf(DayOfWeek.class);
                for (char c : halves[0].toCharArray()) {
                    days.add(DayOfWeek.of(c - '0'));
                }
                String[] times = halves[1].split("-");
                if (times.length != 2) {
                    return null;
                }
                segments.add(new Segment(days, toMinute(times[0]), toMinute(times[1])));
            }
            return of(segments);
        } catch (RuntimeException exception) {
            return null;
        }
    }

    public String toSpec() {
        StringBuilder spec = new StringBuilder();
        for (Segment segment : segments) {
            if (!spec.isEmpty()) {
                spec.append(';');
            }
            segment.days().stream().sorted()
                .forEach(day -> spec.append(day.getValue()));
            spec.append(':')
                .append(String.format("%04d", toHhmm(segment.openMinute())))
                .append('-')
                .append(String.format("%04d", toHhmm(segment.closeMinute())));
        }
        return spec.toString();
    }

    public boolean isOpenAt(LocalDateTime at) {
        int minuteOfDay = at.getHour() * 60 + at.getMinute();
        DayOfWeek day = at.getDayOfWeek();
        return segments.stream().anyMatch(segment -> segment.coversAt(day, minuteOfDay));
    }

    private static int toMinute(String hhmm) {
        int value = Integer.parseInt(hhmm);
        int hour = value / 100;
        int minute = value % 100;
        if (hour < 0 || hour > 24 || minute < 0 || minute > 59) {
            throw new IllegalArgumentException("잘못된 시각: " + hhmm);
        }
        return Math.min(hour * 60 + minute, MINUTES_PER_DAY);
    }

    private static int toHhmm(int minuteOfDay) {
        return (minuteOfDay / 60) * 100 + (minuteOfDay % 60);
    }
}
