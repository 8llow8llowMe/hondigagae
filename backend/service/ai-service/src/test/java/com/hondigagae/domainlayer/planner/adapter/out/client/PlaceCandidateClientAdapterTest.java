package com.hondigagae.domainlayer.planner.adapter.out.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.PinnedPlaceCandidateClient;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.PlaceCandidateClient;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto.PlaceSliceClientResponse;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto.PlaceSliceClientResponse.PlaceItemClientResponse;
import com.hondigagae.domainlayer.planner.adapter.out.client.support.InternalResponseSupport;
import com.hondigagae.domainlayer.planner.application.port.out.query.PlaceCandidateQueryResult;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PlaceCandidateClientAdapterTest {

    @Mock
    private PlaceCandidateClient placeCandidateClient;

    @Mock
    private PinnedPlaceCandidateClient pinnedPlaceCandidateClient;

    @Test
    @DisplayName("실내 카페 요청은 검색 필터로 넘긴다 (#1170)")
    void passesIndoorCafeFilters() {
        PlaceCandidateClientAdapter adapter = new PlaceCandidateClientAdapter(
            placeCandidateClient,
            pinnedPlaceCandidateClient,
            new InternalResponseSupport(CircuitBreakerRegistry.ofDefaults()));
        when(placeCandidateClient.searchPlaces("39", null, "ALLOWED", 8, true, "카페", null))
            .thenReturn(Response.success(new PlaceSliceClientResponse(List.of(
                new PlaceItemClientResponse(
                    "11", null, "바다뷰 카페", "제주시", 33.5, 126.5, null, null, null, true, "카페")),
                false)));

        List<PlaceCandidateQueryResult> results =
            adapter.findRequestedCandidates("39", null, 8, true, "카페");

        assertThat(results).singleElement().satisfies(place -> {
            assertThat(place.placeId()).isEqualTo(11L);
            assertThat(place.indoor()).isTrue();
            assertThat(place.sourceCategory()).isEqualTo("카페");
        });
    }

    @Test
    @DisplayName("숙박 조회는 콘텐츠 타입 LODGING 과 시군구를 검색에 넘긴다 (#1236)")
    void passesLodgingContentType() {
        PlaceCandidateClientAdapter adapter = new PlaceCandidateClientAdapter(
            placeCandidateClient,
            pinnedPlaceCandidateClient,
            new InternalResponseSupport(CircuitBreakerRegistry.ofDefaults()));
        when(placeCandidateClient.searchPlaces("39", "4", "ALLOWED", 50, null, null, "LODGING"))
            .thenReturn(Response.success(new PlaceSliceClientResponse(List.of(
                new PlaceItemClientResponse(
                    "21", null, "포시즌펜션", "서귀포시", 33.248, 126.565, null, null, null, true, "펜션")),
                false)));

        List<PlaceCandidateQueryResult> results = adapter.findLodgingCandidates("39", "4", 50);

        assertThat(results).singleElement().satisfies(place -> {
            assertThat(place.placeId()).isEqualTo(21L);
            assertThat(place.title()).isEqualTo("포시즌펜션");
        });
    }

    @Test
    @DisplayName("음식점 조회는 콘텐츠 타입 RESTAURANT 를 검색에 넘긴다 — 카페도 이 타입이다 (#1245)")
    void passesRestaurantContentType() {
        PlaceCandidateClientAdapter adapter = new PlaceCandidateClientAdapter(
            placeCandidateClient,
            pinnedPlaceCandidateClient,
            new InternalResponseSupport(CircuitBreakerRegistry.ofDefaults()));
        when(placeCandidateClient.searchPlaces("39", null, "ALLOWED", 50, null, null, "RESTAURANT"))
            .thenReturn(Response.success(new PlaceSliceClientResponse(List.of(
                new PlaceItemClientResponse(
                    "31", null, "애월더선셋", "제주시 애월읍", 33.47, 126.33, null, null, null, true, "카페")),
                false)));

        List<PlaceCandidateQueryResult> results = adapter.findRestaurantCandidates("39", null, 50);

        assertThat(results).singleElement().satisfies(place -> {
            assertThat(place.placeId()).isEqualTo(31L);
            assertThat(place.sourceCategory()).isEqualTo("카페");
        });
    }
}
