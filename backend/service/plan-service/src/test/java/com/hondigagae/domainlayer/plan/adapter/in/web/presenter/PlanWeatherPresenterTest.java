package com.hondigagae.domainlayer.plan.adapter.in.web.presenter;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanDayWeatherItem;
import com.hondigagae.domainlayer.plan.application.info.PlanDaySuitabilityInfo;
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
}
