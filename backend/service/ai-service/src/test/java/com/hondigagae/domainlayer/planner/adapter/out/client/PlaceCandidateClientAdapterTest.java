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
        when(placeCandidateClient.searchPlaces("39", null, "ALLOWED", 8, true, "카페"))
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
}
