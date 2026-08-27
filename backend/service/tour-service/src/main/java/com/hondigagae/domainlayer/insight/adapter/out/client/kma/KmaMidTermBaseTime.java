package com.hondigagae.domainlayer.insight.adapter.out.client.kma;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;

/**
 * 중기예보 발표 회차({@code tmFc}) 계산.
 *
 * <p>단기예보는 하루 8회지만 중기예보는 <b>1일 2회(06시, 18시)</b>다. 같은 문제라도 주기가
 * 달라 계산을 따로 둔다 - {@link KmaBaseTime} 에 분기를 넣으면 어느 예보의 규칙인지 읽기 어려워진다.
 *
 * <p>발표시각 형식도 다르다. 단기예보는 {@code base_date} + {@code base_time} 두 파라미터지만
 * 중기예보는 {@code tmFc=yyyyMMddHHmm} 한 파라미터다.
 *
 * <p>기상청 프로토콜 세부사항이므로 adapter 밖으로 나가지 않는다.
 */
record KmaMidTermBaseTime(LocalDate baseDate, LocalTime baseTime) {

    /** 발표시각. 오름차순으로 유지한다. */
    private static final int[] PUBLISH_HOURS = {6, 18};

    private static final DateTimeFormatter TM_FC_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmm");

    /**
     * {@code now} 시점에 조회 가능한 가장 최근 발표 회차.
     *
     * @param publishDelayMinutes 발표시각 이후 데이터가 실제로 올라오기까지의 여유(분)
     */
    static KmaMidTermBaseTime latestAvailable(LocalDateTime now, int publishDelayMinutes) {
        LocalDateTime usable = now.minusMinutes(publishDelayMinutes);
        LocalDate date = usable.toLocalDate();

        for (int index = PUBLISH_HOURS.length - 1; index >= 0; index--) {
            int hour = PUBLISH_HOURS[index];
            if (usable.getHour() >= hour) {
                return new KmaMidTermBaseTime(date, LocalTime.of(hour, 0));
            }
        }
        // 자정 ~ 06시대: 어제 18시 회차를 쓴다.
        return new KmaMidTermBaseTime(date.minusDays(1), LocalTime.of(PUBLISH_HOURS[PUBLISH_HOURS.length - 1], 0));
    }

    /** 직전 발표 회차. 최신 회차가 빈 응답을 줄 때 한 단계 물러서기 위한 것이다. */
    KmaMidTermBaseTime previous() {
        int currentHour = baseTime.getHour();
        for (int index = PUBLISH_HOURS.length - 1; index >= 0; index--) {
            if (PUBLISH_HOURS[index] < currentHour) {
                return new KmaMidTermBaseTime(baseDate, LocalTime.of(PUBLISH_HOURS[index], 0));
            }
        }
        return new KmaMidTermBaseTime(baseDate.minusDays(1), LocalTime.of(PUBLISH_HOURS[PUBLISH_HOURS.length - 1], 0));
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

    /**
     * 예보 일차(N)가 가리키는 날짜.
     *
     * <p>중기예보는 응답 필드명에 일차가 박혀 있고({@code wf3Am}, {@code taMin3}), 그 일차는
     * <b>발표일 기준</b>이다. 조회한 시각이 아니라 발표일에서 세어야 한다 - 18시 회차를
     * 다음 날 새벽에 조회하면 하루가 밀린다.
     */
    LocalDate dateOfDayOffset(int dayOffset) {
        return baseDate.plusDays(dayOffset);
    }

    String tmFcParam() {
        return LocalDateTime.of(baseDate, baseTime).format(TM_FC_FORMAT);
    }
}
