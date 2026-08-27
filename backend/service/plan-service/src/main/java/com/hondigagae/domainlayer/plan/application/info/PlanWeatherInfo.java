package com.hondigagae.domainlayer.plan.application.info;

import com.hondigagae.domainlayer.plan.application.port.out.query.PlaceSuitabilityQueryResult;
import java.time.LocalDate;
import java.util.List;
import lombok.Builder;

/**
 * 일정 날씨 브리핑.
 *
 * <p>일자별로 접는 것이 이 응답의 형태를 정한다. 사용자가 묻는 것은 "둘째 날 괜찮아?"이지
 * "3번 항목 괜찮아?"가 아니다.
 */
@Builder
public record PlanWeatherInfo(
    long planId,
    String planTitle,
    LocalDate startDate,
    LocalDate endDate,
    boolean petConditionApplied,
    List<PlanDayWeatherInfo> days
) {

    /**
     * 하루치 브리핑.
     *
     * @param suitability 그날의 대표 장소 기준 적합도. 장소 항목이 없거나 조회에 실패하면 null
     * @param unavailableReason 브리핑을 못 낸 이유. null 이면 정상이다
     */
    @Builder
    public record PlanDayWeatherInfo(
        int day,
        LocalDate date,
        Long representativePlaceId,
        String representativePlaceTitle,
        PlaceSuitabilityQueryResult suitability,
        String unavailableReason
    ) {

        public static PlanDayWeatherInfo unavailable(int day, LocalDate date, String reason) {
            return PlanDayWeatherInfo.builder().day(day).date(date).unavailableReason(reason).build();
        }
    }
}
