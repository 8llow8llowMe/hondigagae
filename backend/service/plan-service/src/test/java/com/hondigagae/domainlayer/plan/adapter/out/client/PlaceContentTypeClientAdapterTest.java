package com.hondigagae.domainlayer.plan.adapter.out.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.plan.adapter.out.client.feign.PetConditionClient;
import com.hondigagae.domainlayer.plan.adapter.out.client.feign.PlaceSuitabilityClient;
import com.hondigagae.domainlayer.plan.adapter.out.client.feign.PlaceWalkSafetyClient;
import com.hondigagae.domainlayer.plan.adapter.out.client.feign.PlanPlaceLookupClient;
import com.hondigagae.domainlayer.plan.adapter.out.client.feign.dto.PlaceSuitabilityClientResponse;
import com.hondigagae.domainlayer.plan.adapter.out.client.feign.dto.PlanPlaceClientResponse;
import com.hondigagae.domainlayer.plan.adapter.out.client.support.InternalResponseSupport;
import com.hondigagae.domainlayer.plan.application.port.out.query.PetConditionQueryResult;
import com.hondigagae.domainlayer.plan.application.port.out.query.PlaceSuitabilityQueryResult;
import com.hondigagae.domainlayer.plan.application.port.out.query.PlaceSuitabilityQueryResult.AlternativeQueryResult;
import com.hondigagae.domainlayer.plan.application.port.out.query.PlanPlaceSummaryQueryResult;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * tour-service 가 주는 장소 유형 · 원본 분류가 어댑터를 지나 QueryResult 로 건너오는지 고정한다 (#1461).
 *
 * <p>Feign DTO 는 {@code @JsonIgnoreProperties(ignoreUnknown = true)} 라 <b>칸 이름이 원천과 어긋나도 오류 없이 null 이
 * 된다</b> — 그러면 프론트는 음식점 대안 · 이미 담긴 음식점을 식사로 세지 못하고, 아무것도 실패하지 않는다
 * ({@code ScoreMetadataClientResponseContractTest} 와 같은 이유). 그래서 원천 응답 모양의 JSON 을 실제로 역직렬화해 어댑터에
 * 넣는다. 원천에 있는 다른 칸(표시명 등)도 함께 넣어 모르는 칸이 버려지는 것까지 본다.
 */
class PlaceContentTypeClientAdapterTest {

    private static final LocalDate DATE = LocalDate.of(2026, 9, 12);

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();
    private final InternalResponseSupport internalResponseSupport = new InternalResponseSupport(CircuitBreakerRegistry.ofDefaults());

    private final PlaceSuitabilityClient placeSuitabilityClient = mock(PlaceSuitabilityClient.class);
    private final PlanInsightClientAdapter insightAdapter = new PlanInsightClientAdapter(
        mock(PetConditionClient.class), placeSuitabilityClient, mock(PlaceWalkSafetyClient.class), internalResponseSupport);

    private final PlanPlaceLookupClient planPlaceLookupClient = mock(PlanPlaceLookupClient.class);
    private final PlanPlaceLookupClientAdapter lookupAdapter = new PlanPlaceLookupClientAdapter(planPlaceLookupClient, internalResponseSupport);

    @Test
    @DisplayName("적합도 응답의 실내 대안 장소 유형 metadata 와 원본 분류가 QueryResult 로 건너온다")
    void alternativeContentTypeCrossesTheAdapter() throws Exception {
        PlaceSuitabilityClientResponse body = objectMapper.readValue("""
            {"placeId":"100","placeTitle":"협재해수욕장","targetDate":"2026-09-12","score":55,"reasons":[],
             "weatherApplied":true,"congestionApplied":false,
             "indoorAlternatives":[
               {"placeId":"200","title":"오설록 티뮤지엄","lat":33.3058,"lng":126.2895,"distanceMeters":2340,
                "petAllowanceType":{"code":"ALLOWED","name":"동반 가능","description":"반려견 동반이 가능합니다."},
                "contentType":{"code":"RESTAURANT","name":"음식점","description":"음식점, 카페"},"sourceCategory":"카페"},
               {"placeId":"300","title":"유형 없는 곳","lat":33.3,"lng":126.3,"distanceMeters":4100}]}""",
            PlaceSuitabilityClientResponse.class);
        when(placeSuitabilityClient.getSuitability(anyLong(), any(), any(), anyBoolean(), anyBoolean(), anyBoolean(), any()))
            .thenReturn(Response.success(body));

        PlaceSuitabilityQueryResult result = insightAdapter.findSuitability(100L, DATE, PetConditionQueryResult.builder().build())
            .orElseThrow();

        assertThat(result.indoorAlternatives()).hasSize(2);
        AlternativeQueryResult cafe = result.indoorAlternatives().get(0);
        assertThat(cafe.placeId()).isEqualTo(200L);
        assertThat(cafe.contentTypeCode()).isEqualTo("RESTAURANT");
        assertThat(cafe.contentTypeName()).isEqualTo("음식점");
        assertThat(cafe.contentTypeDescription()).isEqualTo("음식점, 카페");
        assertThat(cafe.sourceCategory()).isEqualTo("카페");

        // 원천이 유형을 주지 않은 대안 — 옛 버전 tour-service 응답도 이 모양이다. 지어내지 않고 null 로 둔다.
        AlternativeQueryResult unknown = result.indoorAlternatives().get(1);
        assertThat(unknown.contentTypeCode()).isNull();
        assertThat(unknown.contentTypeName()).isNull();
        assertThat(unknown.contentTypeDescription()).isNull();
        assertThat(unknown.sourceCategory()).isNull();
    }

    @Test
    @DisplayName("내부 후보 응답의 장소 유형 코드 · 표시명 · 설명 · 원본 분류가 장소 요약으로 건너온다")
    void placeSummaryContentTypeCrossesTheAdapter() throws Exception {
        List<PlanPlaceClientResponse> body = objectMapper.readValue("""
            [{"placeId":200,"title":"오설록 티뮤지엄","contentTypeCode":"RESTAURANT","contentTypeName":"음식점",
              "contentTypeDescription":"음식점, 카페",
              "addr":"제주특별자치도 서귀포시 안덕면 신화역사로 15","petAllowanceName":"동반 가능","indoor":true,
              "sourceCategory":"카페","lat":33.3058,"lng":126.2895},
             {"placeId":300,"title":"유형 없는 곳","addr":"제주특별자치도 제주시"}]""",
            new TypeReference<>() {
            });
        when(planPlaceLookupClient.getPlaceSummaries(List.of(200L, 300L))).thenReturn(Response.success(body));

        List<PlanPlaceSummaryQueryResult> summaries = lookupAdapter.findSummaries(List.of(200L, 300L));

        assertThat(summaries).hasSize(2);
        PlanPlaceSummaryQueryResult cafe = summaries.get(0);
        assertThat(cafe.contentTypeCode()).isEqualTo("RESTAURANT");
        assertThat(cafe.contentTypeName()).isEqualTo("음식점");
        assertThat(cafe.contentTypeDescription()).isEqualTo("음식점, 카페");
        assertThat(cafe.sourceCategory()).isEqualTo("카페");

        PlanPlaceSummaryQueryResult unknown = summaries.get(1);
        assertThat(unknown.contentTypeCode()).isNull();
        assertThat(unknown.contentTypeName()).isNull();
        assertThat(unknown.contentTypeDescription()).isNull();
        assertThat(unknown.sourceCategory()).isNull();
    }
}
