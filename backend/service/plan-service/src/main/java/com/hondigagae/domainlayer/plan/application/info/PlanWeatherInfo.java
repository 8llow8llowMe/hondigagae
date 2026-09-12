package com.hondigagae.domainlayer.plan.application.info;

import com.hondigagae.domainlayer.plan.domain.enums.PlanDayWeatherUnavailableReason;
import java.time.LocalDate;
import java.util.List;
import lombok.Builder;

/**
 * 일정 날씨 브리핑.
 *
 * <p>일자별로 접는 것이 이 응답의 형태를 정한다. 사용자가 묻는 것은 "둘째 날 괜찮아?"이지
 * "3번 항목 괜찮아?"가 아니다.
 *
 * @param petIds 판정에 들어간 동행 반려견. 일자별 {@code basisPetId} 는 이 안의 하나다
 */
@Builder
public record PlanWeatherInfo(
    long planId,
    String planTitle,
    LocalDate startDate,
    LocalDate endDate,
    List<Long> petIds,
    boolean petConditionApplied,
    List<PlanDayWeatherInfo> days
) {

    /**
     * 하루치 브리핑.
     *
     * @param basisPetId 그날 판정의 기준이 된 반려견 — 아이별 판정 중 <b>점수가 가장 낮은</b> 아이다.
     *                   장소 항목이 없거나 조회에 실패하면 null
     * @param suitability {@code basisPetId} 기준 적합도. 장소 항목이 없거나 조회에 실패하면 null
     * @param petSuitabilities 아이별 점수·등급. 화면이 "누구 기준인지"와 "다른 아이는 어떤지"를 함께 말할 수 있다
     * @param unavailableReason 브리핑을 못 낸 이유. null 이면 정상이다. <b>문장이 아니라 사유 자체를 든다</b> —
     *                          문장은 enum 이 갖고 Presenter 가 코드와 함께 내린다 (#492)
     */
    @Builder
    public record PlanDayWeatherInfo(
        int day,
        LocalDate date,
        Long representativePlaceId,
        String representativePlaceTitle,
        Long basisPetId,
        PlanDaySuitabilityInfo suitability,
        List<PetSuitabilityInfo> petSuitabilities,
        PlanDayWeatherUnavailableReason unavailableReason
    ) {

        public static PlanDayWeatherInfo unavailable(
            int day, LocalDate date, PlanDayWeatherUnavailableReason reason
        ) {
            return unavailable(day, date, null, null, reason);
        }

        /**
         * 대표 장소를 아는 채로 못 낸 날. <b>장소는 그대로 내린다</b> — 지난 날짜라 예보가 없는 것과
         * 장소가 없는 것은 다른 사실이고, 화면은 그날 어디를 가기로 했는지를 여전히 보여 준다.
         */
        public static PlanDayWeatherInfo unavailable(
            int day, LocalDate date, Long placeId, String placeTitle, PlanDayWeatherUnavailableReason reason
        ) {
            return PlanDayWeatherInfo.builder()
                .day(day).date(date)
                .representativePlaceId(placeId).representativePlaceTitle(placeTitle)
                .petSuitabilities(List.of()).unavailableReason(reason).build();
        }
    }

    /** 한 마리의 그날 판정 요약. 근거·날씨는 기준 반려견의 {@code suitability} 에만 붙인다 — 날씨는 아이마다 같다. */
    @Builder
    public record PetSuitabilityInfo(
        long petId,
        Integer score,
        String levelCode,
        String levelName,
        String levelDescription
    ) {
    }
}
