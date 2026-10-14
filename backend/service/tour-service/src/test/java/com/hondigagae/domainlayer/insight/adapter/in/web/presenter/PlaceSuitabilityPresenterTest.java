package com.hondigagae.domainlayer.insight.adapter.in.web.presenter;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.insight.adapter.in.web.dto.item.AlternativePlaceItem;
import com.hondigagae.domainlayer.insight.adapter.in.web.dto.response.PlaceSuitabilityResponse;
import com.hondigagae.domainlayer.insight.application.info.AlternativePlaceInfo;
import com.hondigagae.domainlayer.insight.application.info.PlaceSuitabilityInfo;
import com.hondigagae.domainlayer.insight.domain.enums.SuitabilityReasonCode;
import com.hondigagae.domainlayer.insight.domain.model.SuitabilityReason;
import com.hondigagae.domainlayer.insight.domain.model.SuitabilityScore;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 적합도 응답의 결론 문구 (#1234).
 *
 * <p>프레젠터는 Processor 가 정한 문구를 <b>옮기기만</b> 한다. 여기서 등급을 보고 문구를 다시 만들면
 * 규칙이 두 곳이 되고, 결론을 뒤집는 감점(동반 불가 등)을 아는 쪽은 도메인뿐이라 두 문구가 갈라진다.
 */
class PlaceSuitabilityPresenterTest {

    private final PlaceSuitabilityPresenter presenter = new PlaceSuitabilityPresenter(new InsightPresenter());

    @Test
    @DisplayName("Info 의 결론 문구를 그대로 싣는다 - 등급으로 다시 만들지 않는다")
    void carriesHeadlineAsIs() {
        // 등급(HIGH)과 일부러 다른 문구를 준다. 프레젠터가 등급으로 문구를 지으면 여기서 드러난다.
        PlaceSuitabilityResponse response = presenter.toResponse(info(92, "반려견과 함께 들어갈 수 없는 곳이에요"));

        assertThat(response.headline()).isEqualTo("반려견과 함께 들어갈 수 없는 곳이에요");
    }

    @Test
    @DisplayName("결론 문구가 null 이면 null 로 둔다 - 화면이 등급명으로 폴백한다")
    void keepsNullHeadline() {
        PlaceSuitabilityResponse response = presenter.toResponse(info(92, null));

        assertThat(response.headline()).isNull();
        assertThat(response.suitabilityLevel().name()).isEqualTo("여행 적합");
    }

    /**
     * 실내 대안을 일정에 담을 때 프론트가 음식점이면 식사(MEAL)로 저장한다 (#1447). 그 판정은 장소 목록과 같은
     * {@code contentType.code} · {@code sourceCategory} 를 보므로 대안도 같은 모양으로 실어야 한다 (#1461).
     */
    @Test
    @DisplayName("실내 대안이 장소 유형 metadata 와 원본 분류를 싣는다 — 장소 목록과 같은 모양이다 (#1461)")
    void alternativeCarriesContentTypeAndSourceCategory() {
        PlaceSuitabilityResponse response = presenter.toResponse(infoWithAlternatives(
            alternative("39", "카페")));

        AlternativePlaceItem item = response.indoorAlternatives().getFirst();
        assertThat(item.contentType().code()).isEqualTo("RESTAURANT");
        assertThat(item.contentType().name()).isEqualTo("음식점");
        assertThat(item.contentType().description()).isEqualTo("음식점, 카페");
        assertThat(item.sourceCategory()).isEqualTo("카페");
    }

    @Test
    @DisplayName("유형을 모르거나 없으면 contentType 은 null 이다 — 대안 한 곳 때문에 적합도 응답이 깨지지 않는다")
    void unknownContentTypeBecomesNull() {
        PlaceSuitabilityResponse response = presenter.toResponse(infoWithAlternatives(
            alternative(null, null), alternative("99", "기타")));

        assertThat(response.indoorAlternatives()).extracting(AlternativePlaceItem::contentType).containsOnlyNulls();
        assertThat(response.indoorAlternatives()).extracting(AlternativePlaceItem::sourceCategory).containsExactly(null, "기타");
    }

    private static PlaceSuitabilityInfo info(int points, String headline) {
        return PlaceSuitabilityInfo.builder()
            .placeId(212481712381923328L)
            .placeTitle("천지연폭포")
            .targetDate(LocalDate.of(2026, 8, 27))
            .score(SuitabilityScore.scored(points, List.of(
                SuitabilityReason.informational(SuitabilityReasonCode.PET_ALLOWED, "반려견 출입이 확인된 장소입니다.")), true, false))
            .headline(headline)
            .indoorAlternatives(List.of())
            .build();
    }

    private static PlaceSuitabilityInfo infoWithAlternatives(AlternativePlaceInfo... alternatives) {
        return PlaceSuitabilityInfo.builder()
            .placeId(212481712381923328L)
            .placeTitle("천지연폭포")
            .targetDate(LocalDate.of(2026, 8, 27))
            .score(SuitabilityScore.scored(70, List.of(), true, false))
            .indoorAlternatives(List.of(alternatives))
            .build();
    }

    private static AlternativePlaceInfo alternative(String contentTypeId, String sourceCategory) {
        return AlternativePlaceInfo.builder()
            .placeId(1L).title("오설록 티뮤지엄").lat(33.3058d).lng(126.2895d).distanceMeters(2340)
            .contentTypeId(contentTypeId).sourceCategory(sourceCategory)
            .build();
    }
}
