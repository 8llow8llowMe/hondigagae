package com.hondigagae.domainlayer.place.adapter.in.web.presenter;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.place.adapter.in.web.dto.response.PlaceDetailResponse;
import com.hondigagae.domainlayer.place.application.info.PlaceDetailInfo;
import com.hondigagae.domainlayer.place.domain.enums.PlaceSource;
import com.hondigagae.domainlayer.place.domain.model.Place;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 장소 상세 응답 변환 검증.
 *
 * <p>여기서 지키는 것은 두 가지다 — <b>원천에 없는 값이 있는 값처럼 내려가지 않는 것</b>(이슈 #17)과
 * <b>목록에만 있던 세 필드가 상세에도 오는 것</b>(이슈 #16). 둘 다 컴파일로 잡히지 않고 실제 호출
 * 없이는 드러나지 않아서 여기에 고정한다.
 */
class PlacePresenterTest {

    private final PlacePresenter presenter = new PlacePresenter();

    /** 문화정보원 원천 장소 — {@code contentId} 가 null 이고 세 필드는 채워져 있다 */
    private static Place.PlaceBuilder culturePortalPlace() {
        return Place.builder()
            .id(212481712381923328L)
            .source(PlaceSource.CULTURE_PORTAL)
            .sourceKey("culture-1")
            .sourceCategory("카페")
            .contentId(null)
            .contentTypeId("39")
            .title("제주현대미술관")
            .addr1("제주특별자치도 제주시 한경면 저지14길 35")
            .lat(new BigDecimal("33.3608276172"))
            .lng(new BigDecimal("126.4106264"))
            .petAvailable(true)
            .petAllowanceType(PetAllowanceType.ALLOWED)
            .indoor(true);
    }

    private PlaceDetailResponse detailOf(Place.PlaceBuilder place) {
        return presenter.toDetailResponse(PlaceDetailInfo.builder()
            .place(place.build())
            .images(List.of())
            .build());
    }

    @Test
    @DisplayName("contentId 가 null 이면 문자열 \"null\" 이 아니라 null 로 내려간다 (#17)")
    void contentIdStaysNull() {
        PlaceDetailResponse response = detailOf(culturePortalPlace());

        assertThat(response.contentId()).isNull();
        // 회귀 방지의 핵심 — "null" 은 길이 4의 유효한 문자열이라 클라이언트 null 검사를 통과한다
        assertThat(response.contentId()).isNotEqualTo("null");
    }

    @Test
    @DisplayName("contentId 가 있으면 문자열로 내려간다 — 안전 정수 범위를 넘기 때문이다")
    void contentIdSerializedAsString() {
        PlaceDetailResponse response = detailOf(culturePortalPlace()
            .source(PlaceSource.TOUR_API)
            .contentId(126439L));

        assertThat(response.contentId()).isEqualTo("126439");
    }

    @Test
    @DisplayName("placeId 도 문자열이다 — @Id 라 null 이 될 수 없다")
    void placeIdSerializedAsString() {
        assertThat(detailOf(culturePortalPlace()).placeId()).isEqualTo("212481712381923328");
    }

    @Test
    @DisplayName("indoor · sourceCategory · sourceName 이 상세 응답에 담긴다 (#16)")
    void detailCarriesListOnlyFields() {
        PlaceDetailResponse response = detailOf(culturePortalPlace());

        assertThat(response.indoor()).isTrue();
        assertThat(response.sourceCategory()).isEqualTo("카페");
        // 원천 코드가 아니라 표시명이다 — 목록(PlaceItem)과 같은 매핑을 쓴다
        assertThat(response.sourceName()).isEqualTo("문화정보원");
    }

    @Test
    @DisplayName("indoor 는 null 을 유지한다 — \"정보 없음\" 과 \"실외\" 는 다르다 (#16)")
    void indoorStaysNull() {
        PlaceDetailResponse response = detailOf(culturePortalPlace().indoor(null));

        assertThat(response.indoor()).isNull();
    }

    @Test
    @DisplayName("sourceCategory 가 없는 원천이면 null 로 내려간다 — 빈 문자열을 만들지 않는다")
    void sourceCategoryStaysNull() {
        PlaceDetailResponse response = detailOf(culturePortalPlace().sourceCategory(null));

        assertThat(response.sourceCategory()).isNull();
    }
}
