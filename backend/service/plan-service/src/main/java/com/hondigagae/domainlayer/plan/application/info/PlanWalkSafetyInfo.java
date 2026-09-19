package com.hondigagae.domainlayer.plan.application.info;

import com.hondigagae.domainlayer.plan.domain.enums.PlanItemWalkSafetyUnavailableReason;
import com.hondigagae.domainlayer.plan.domain.model.PlanItem;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import lombok.Builder;

/**
 * 일정 항목별 산책 위험도.
 *
 * <p>일자 날씨({@link PlanWeatherInfo})는 "둘째 날 괜찮아?" 에 답하고, 이것은 "두 시에 그
 * 해수욕장 걸어도 돼?" 에 답한다. 산책 위험도는 <b>시각에 따라 갈리므로</b> 일자로 접을 수
 * 없고, 그래서 항목 단위로 따로 낸다.
 */
@Builder
public record PlanWalkSafetyInfo(
    long planId,
    String planTitle,
    List<Long> petIds,
    List<PlanItemWalkSafetyInfo> items
) {

    /**
     * 항목 하나의 판정.
     *
     * @param placeId 그 항목이 가리키는 장소. <b>판정을 못 낸 항목에도 남긴다</b> — 화면이 그 줄에서
     *                장소 위험도 API 를 직접 부를 수 있어야 한다. 장소 항목이 아니면(NOT_PLACE_TARGET) null
     * @param placeTitle tour-service 가 확인해 준 장소명. <b>물어보지 못한 항목은 null</b> — 일정에 적힌
     *                   이름({@code title})을 여기 넣으면 확인되지 않은 이름이 확인된 것처럼 보인다.
     *                   {@link PlanItemWalkSafetyUnavailableReason#NO_FORECAST_AT_TIME} 은 물어본
     *                   줄이라 값이 남는다 — 사유가 있다고 해서 이 칸이 비는 것은 아니다
     * @param basisPetId 판정 기준 반려견. <b>그날 날씨 판정의 기준과 같다</b> — 같은 날을 두 화면이
     *                   다른 아이 기준으로 말하지 않게 한다. 못 낸 항목은 null
     *                   ({@code NO_FORECAST_AT_TIME} 은 위와 같은 이유로 예외)
     * @param levelScoreDescription 등급 점수 해석 문장. 원천이 주는 값을 그대로 옮긴다 (#717)
     * @param petConditionApplied 그 판정에 기준 반려견의 특성이 반영됐는지. <b>Wrapper 다</b> —
     *                            판정을 못 낸 항목은 원천에 묻지 않았으므로 값 자체가 없고 null 이다
     *                            ({@code NO_FORECAST_AT_TIME} 은 물어본 줄이라 예외).
     *                            {@code false}("물어봤고, 특성 없이 일반 조건으로 판정했다")와 다른 사실이라
     *                            primitive 로 접으면 하지 않은 판정을 했다고 말하게 된다
     * @param unavailableReason 못 낸 이유. null 이면 정상이다. 문장이 아니라 사유 자체를 든다 —
     *                          문장은 enum 이 갖고 Presenter 가 코드와 함께 내린다.
     *                          <b>{@link PlanItemWalkSafetyUnavailableReason#NO_FORECAST_AT_TIME} 만
     *                          예외로 {@code levelCode} 가 함께 남는다</b>({@code UNKNOWN}) — 그 줄은
     *                          원천에 실제로 물어봤고 원천이 {@code UNKNOWN} 을 <b>답으로</b> 줬다
     */
    @Builder
    public record PlanItemWalkSafetyInfo(
        long planItemId,
        int day,
        LocalDate date,
        int sequence,
        LocalTime startTime,
        String title,
        Long placeId,
        String placeTitle,
        LocalDateTime targetDateTime,
        Long basisPetId,
        String levelCode,
        String levelName,
        String levelDescription,
        String levelScoreDescription,
        Double estimatedPavementCelsius,
        Double feelsLikeCelsius,
        Double temperature,
        LocalTime saferWindowStart,
        LocalTime saferWindowEnd,
        Boolean petConditionApplied,
        PlanItemWalkSafetyUnavailableReason unavailableReason
    ) {

        /**
         * 가리키는 장소를 모르는 채로 못 낸 항목. 항목 자체는 그대로 내린다 — 화면은 그 줄을
         * 여전히 그려야 한다.
         *
         * <p>{@link PlanItemWalkSafetyUnavailableReason#NOT_PLACE_TARGET} 이 유일한 자리다.
         * 나머지 사유는 장소를 아는 상태에서 갈리므로 아래 오버로드를 쓴다.
         */
        public static PlanItemWalkSafetyInfo unavailable(
            PlanItem item, LocalDate date, PlanItemWalkSafetyUnavailableReason reason
        ) {
            return unavailable(item, date, null, reason);
        }

        /**
         * 가리키는 장소를 아는 채로 못 낸 항목. <b>장소는 그대로 내린다</b> — 지난 날짜라 예보가
         * 없는 것과 장소 항목이 아닌 것은 다른 사실이고, 화면은 그 줄이 어디를 가리키는지를
         * 여전히 보여 줘야 한다 ({@code PlanWeatherInfo.PlanDayWeatherInfo#unavailable} 과 같은 축).
         *
         * <p>특히 {@link PlanItemWalkSafetyUnavailableReason#LOOKUP_FAILED} 줄에서 화면이 장소
         * 산책 위험도 API 를 직접 부를 수 있으려면 이 값이 있어야 한다 — 비우면 "필요하면 직접
         * 부르세요" 라는 안내가 정작 가장 필요한 줄에서 지켜지지 않는다.
         *
         * <p>{@code placeTitle} 은 반대로 비운다. 그것은 <b>tour-service 가 확인해 준 이름</b>이라,
         * 물어보지 못한 항목에 일정에 적힌 제목을 넣으면 확인되지 않은 이름을 확인된 것처럼
         * 말하게 된다. 일정에 적힌 이름은 {@code title} 로 이미 내려간다.
         *
         * <p>{@code petConditionApplied} 도 빌더에 넣지 않는다 — <b>묻지 않았으므로 값이 없다.</b>
         * 여기에 {@code false} 를 넣으면 "물어봤고 특성 없이 판정했다" 는 뜻이 되어, 하지 않은
         * 판정을 했다고 말하게 된다. 미설정이라 자동으로 null 이다.
         */
        public static PlanItemWalkSafetyInfo unavailable(
            PlanItem item, LocalDate date, Long placeId, PlanItemWalkSafetyUnavailableReason reason
        ) {
            return PlanItemWalkSafetyInfo.builder()
                .planItemId(item.id())
                .day(item.day())
                .date(date)
                .sequence(item.sequence())
                .startTime(item.startTime())
                .title(item.title())
                .placeId(placeId)
                .unavailableReason(reason)
                .build();
        }
    }
}
