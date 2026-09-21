package com.hondigagae.domainlayer.plan.adapter.in.web.presenter;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanDayWeatherItem;
import com.hondigagae.domainlayer.plan.application.info.PlanDaySuitabilityInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanWeatherInfo.PetSuitabilityInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanWeatherInfo.PlanDayWeatherInfo;
import com.hondigagae.domainlayer.plan.domain.enums.PlanDayWeatherUnavailableReason;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

/**
 * 일자 판정의 불가 사유가 <b>코드와 문장 둘 다</b>로 나가는지 고정한다 (#492).
 *
 * <p>문장만 내리면 프론트가 사유별로 다르게 그릴 수 없어 문장을 파싱하게 되고, 코드만 내리면
 * 같은 사실을 서버와 화면이 각자의 문구로 말하게 된다 (#497).
 */
class PlanWeatherPresenterTest {

    private static final LocalDate DATE = LocalDate.of(2026, 9, 11);
    private static final String SCORE_DESCRIPTION = "점수가 높을수록 날씨/동반 조건이 반려견에게 유리합니다.";

    private final PlanWeatherPresenter presenter = new PlanWeatherPresenter();

    @ParameterizedTest
    @EnumSource(PlanDayWeatherUnavailableReason.class)
    @DisplayName("사유가 있으면 코드와 문장이 짝으로 나간다 — 문장의 출처는 enum 하나다")
    void unavailableReasonCarriesBothCodeAndSentence(PlanDayWeatherUnavailableReason reason) {
        PlanDayWeatherItem item = presenter.toDayItem(
            PlanDayWeatherInfo.unavailable(1, DATE, reason));

        assertThat(item.unavailableReasonCode()).isEqualTo(reason.name());
        assertThat(item.unavailableReason()).isEqualTo(reason.getDescription());
    }

    @Test
    @DisplayName("지난 날짜 문장은 재시도를 권하지 않는다 — 과거 예보는 다시 물어도 생기지 않는다")
    void pastDateDoesNotAskForRetry() {
        PlanDayWeatherItem item = presenter.toDayItem(
            PlanDayWeatherInfo.unavailable(1, DATE, 126436L, "성판악",
                PlanDayWeatherUnavailableReason.PAST_DATE));

        assertThat(item.unavailableReasonCode()).isEqualTo("PAST_DATE");
        assertThat(item.unavailableReason()).doesNotContain("다시 시도");
        // 장소가 없어서가 아니라는 것이 응답에 남는다 (#492 실측 케이스)
        assertThat(item.representativePlaceId()).isEqualTo("126436");
        assertThat(item.representativePlaceTitle()).isEqualTo("성판악");
    }

    @Test
    @DisplayName("판정이 나온 날은 코드도 문장도 null 이다 — 정상은 정상으로 읽혀야 한다")
    void normalDayCarriesNoReason() {
        PlanDayWeatherItem item = presenter.toDayItem(PlanDayWeatherInfo.builder()
            .day(1).date(DATE)
            .representativePlaceId(100L).representativePlaceTitle("협재해수욕장")
            .basisPetId(2L)
            .suitability(PlanDaySuitabilityInfo.builder()
                .placeId(100L).placeTitle("협재해수욕장").targetDate(DATE)
                .score(72).levelCode("HIGH").levelName("여행 적합")
                .reasons(List.of()).indoorAlternatives(List.of())
                .build())
            .petSuitabilities(List.of())
            .build());

        assertThat(item.unavailableReasonCode()).isNull();
        assertThat(item.unavailableReason()).isNull();
        assertThat(item.score()).isEqualTo(72);
    }

    /**
     * 등급 점수 해석 문장이 응답까지 나가는지 고정한다 (#759).
     *
     * <p>{@code ScoreMetricMetadata} 는 이 칸을 처음부터 갖고 있었는데 presenter 가 {@code null}
     * 을 박아 넣고 있었다. 아무것도 실패하지 않으니 "언제나 null 인 필드" 로 보였다 — 기준
     * 반려견과 아이별 항목 <b>둘 다</b> 같은 자리라 둘 다 찍는다.
     */
    @Test
    @DisplayName("등급 점수 해석 문장이 기준 반려견·아이별 항목 모두에 실린다")
    void levelScoreDescriptionReachesResponse() {
        PlanDayWeatherItem item = presenter.toDayItem(PlanDayWeatherInfo.builder()
            .day(1).date(DATE)
            .representativePlaceId(100L).representativePlaceTitle("협재해수욕장")
            .basisPetId(2L)
            .suitability(PlanDaySuitabilityInfo.builder()
                .placeId(100L).placeTitle("협재해수욕장").targetDate(DATE)
                .score(72).levelCode("HIGH").levelName("여행 적합")
                .levelDescription("반려견과 방문하기 좋은 조건입니다.")
                .levelScoreDescription(SCORE_DESCRIPTION)
                .reasons(List.of()).indoorAlternatives(List.of())
                .build())
            .petSuitabilities(List.of(PetSuitabilityInfo.builder()
                .petId(2L).score(72).levelCode("HIGH").levelName("여행 적합")
                .levelDescription("반려견과 방문하기 좋은 조건입니다.")
                .levelScoreDescription(SCORE_DESCRIPTION)
                .build()))
            .build());

        assertThat(item.suitabilityLevel().scoreDescription()).isEqualTo(SCORE_DESCRIPTION);
        assertThat(item.petSuitabilities()).singleElement()
            .satisfies(pet -> assertThat(pet.suitabilityLevel().scoreDescription()).isEqualTo(SCORE_DESCRIPTION));
    }

    @Test
    @DisplayName("원천이 해석 문장을 안 주면 null 로 남는다 — 문구를 이쪽에서 지어내지 않는다")
    void missingScoreDescriptionStaysNull() {
        PlanDayWeatherItem item = presenter.toDayItem(PlanDayWeatherInfo.builder()
            .day(1).date(DATE)
            .suitability(PlanDaySuitabilityInfo.builder()
                .placeId(100L).targetDate(DATE)
                .score(40).levelCode("LOW").levelName("주의 필요")
                .reasons(List.of()).indoorAlternatives(List.of())
                .build())
            .petSuitabilities(List.of())
            .build());

        assertThat(item.suitabilityLevel().scoreDescription()).isNull();
    }
}
