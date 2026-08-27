package com.hondigagae.domainlayer.insight.adapter.out.client.kma;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;

/**
 * 단기예보 발표 회차(base_date / base_time) 계산.
 *
 * <p>기상청 단기예보는 하루 8회(02, 05, 08, 11, 14, 17, 20, 23시) 발표하고, 발표시각이 지나도
 * 데이터는 <b>몇 분 뒤에야</b> 올라온다. 현재 시각을 그대로 base_time 으로 넘기면 회차 직후
 * 구간에서 빈 응답이 온다 - 이것이 기상청 연동에서 가장 흔하게 밟는 지점이라 계산을
 * 어댑터 안 한곳에 모으고 {@link #previous()} 로 직전 회차 폴백 경로를 열어 둔다.
 *
 * <p>이 클래스는 기상청 프로토콜 세부사항이므로 adapter 밖으로 나가지 않는다.
 */
record KmaBaseTime(LocalDate baseDate, LocalTime baseTime) {

    /** 발표시각(정시). 오름차순으로 유지한다. */
    private static final int[] PUBLISH_HOURS = {2, 5, 8, 11, 14, 17, 20, 23};

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("HHmm");

    /**
     * {@code now} 시점에 조회 가능한 가장 최근 발표 회차.
     *
     * @param publishDelayMinutes 발표시각 이후 데이터가 실제로 올라오기까지의 여유(분)
     */
    static KmaBaseTime latestAvailable(LocalDateTime now, int publishDelayMinutes) {
        LocalDateTime usable = now.minusMinutes(publishDelayMinutes);
        LocalDate date = usable.toLocalDate();

        for (int index = PUBLISH_HOURS.length - 1; index >= 0; index--) {
            int hour = PUBLISH_HOURS[index];
            if (usable.getHour() >= hour) {
                return new KmaBaseTime(date, LocalTime.of(hour, 0));
            }
        }
        // 자정 ~ 02시대: 어제 마지막 회차를 쓴다.
        return new KmaBaseTime(date.minusDays(1), LocalTime.of(PUBLISH_HOURS[PUBLISH_HOURS.length - 1], 0));
    }

    /** 직전 발표 회차. 최신 회차가 빈 응답을 줄 때 한 단계 물러서기 위한 것이다. */
    KmaBaseTime previous() {
        int currentHour = baseTime.getHour();
        for (int index = PUBLISH_HOURS.length - 1; index >= 0; index--) {
            if (PUBLISH_HOURS[index] < currentHour) {
                return new KmaBaseTime(baseDate, LocalTime.of(PUBLISH_HOURS[index], 0));
            }
        }
        return new KmaBaseTime(baseDate.minusDays(1), LocalTime.of(PUBLISH_HOURS[PUBLISH_HOURS.length - 1], 0));
    }

    /** 다음 발표 회차가 조회 가능해지는 시각. 캐시 TTL 을 여기에 맞춘다. */
    LocalDateTime nextAvailableAt(int publishDelayMinutes) {
        int currentHour = baseTime.getHour();
        for (int publishHour : PUBLISH_HOURS) {
            if (publishHour > currentHour) {
                return LocalDateTime.of(baseDate, LocalTime.of(publishHour, 0)).plusMinutes(publishDelayMinutes);
            }
        }
        return LocalDateTime.of(baseDate.plusDays(1), LocalTime.of(PUBLISH_HOURS[0], 0)).plusMinutes(publishDelayMinutes);
    }

    LocalDateTime publishedAt() {
        return LocalDateTime.of(baseDate, baseTime);
    }

    String baseDateParam() {
        return baseDate.format(DATE_FORMAT);
    }

    String baseTimeParam() {
        return baseTime.format(TIME_FORMAT);
    }
}
