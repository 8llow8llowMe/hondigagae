package com.hondigagae.domainlayer.planner.adapter.out.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.PinnedPlaceCandidateClient;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.PlaceCandidateClient;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto.PlaceCandidateInternalClientResponse;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto.PlaceSliceClientResponse;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto.PlaceSliceClientResponse.MetadataClientResponse;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto.PlaceSliceClientResponse.PlaceItemClientResponse;
import com.hondigagae.domainlayer.planner.adapter.out.client.support.InternalResponseSupport;
import com.hondigagae.domainlayer.planner.application.model.PetAdmission;
import com.hondigagae.domainlayer.planner.application.model.PetCondition;
import com.hondigagae.domainlayer.planner.application.port.out.query.PlaceCandidateQueryResult;
import com.hondigagae.shared.travel.place.AllowedPetSize;
import com.hondigagae.shared.travel.pet.PetSizeType;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PlaceCandidateClientAdapterTest {

    /**
     * 운영 사례(#1420)의 두 마리 — 보리(중형견 · 체중 미상) + 몽실이(소형견 3.2kg). 검색에는 MEDIUM · 10kg 으로 나간다 —
     * 체중 미상 보리는 중형견 하한 10kg 으로 본다.
     */
    private static final PetAdmission BORI_AND_MONGSIL = PetAdmission.of(List.of(
        PetCondition.builder().sizeType(PetSizeType.MEDIUM).build(),
        PetCondition.builder().sizeType(PetSizeType.SMALL).weightKg(new BigDecimal("3.2")).build()));

    @Mock
    private PlaceCandidateClient placeCandidateClient;

    @Mock
    private PinnedPlaceCandidateClient pinnedPlaceCandidateClient;

    @Test
    @DisplayName("실내 카페 요청은 검색 필터로 넘긴다 (#1170)")
    void passesIndoorCafeFilters() {
        PlaceCandidateClientAdapter adapter = adapter();
        when(placeCandidateClient.searchPlaces("39", null, "ALLOWED", 8, true, "카페", null, null, null, null, null))
            .thenReturn(Response.success(new PlaceSliceClientResponse(List.of(
                new PlaceItemClientResponse(
                    "11", null, "바다뷰 카페", "제주시", 33.5, 126.5, null, null, null, true, "카페")),
                false)));

        List<PlaceCandidateQueryResult> results =
            adapter.findRequestedCandidates("39", null, 8, true, "카페", PetAdmission.ANY);

        assertThat(results).singleElement().satisfies(place -> {
            assertThat(place.placeId()).isEqualTo(11L);
            assertThat(place.indoor()).isTrue();
            assertThat(place.sourceCategory()).isEqualTo("카페");
        });
    }

    @Test
    @DisplayName("숙박 조회는 콘텐츠 타입 LODGING 과 시군구를 검색에 넘긴다 (#1236)")
    void passesLodgingContentType() {
        PlaceCandidateClientAdapter adapter = adapter();
        when(placeCandidateClient.searchPlaces("39", "4", "ALLOWED", 50, null, null, "LODGING", null, null, null, null))
            .thenReturn(Response.success(new PlaceSliceClientResponse(List.of(
                new PlaceItemClientResponse(
                    "21", null, "포시즌펜션", "서귀포시", 33.248, 126.565, null, null, null, true, "펜션")),
                false)));

        List<PlaceCandidateQueryResult> results = adapter.findLodgingCandidates("39", "4", 50, PetAdmission.ANY);

        assertThat(results).singleElement().satisfies(place -> {
            assertThat(place.placeId()).isEqualTo(21L);
            assertThat(place.title()).isEqualTo("포시즌펜션");
        });
    }

    @Test
    @DisplayName("음식점 조회는 콘텐츠 타입 RESTAURANT 를 검색에 넘긴다 — 카페도 이 타입이다 (#1245)")
    void passesRestaurantContentType() {
        PlaceCandidateClientAdapter adapter = adapter();
        when(placeCandidateClient.searchPlaces("39", null, "ALLOWED", 50, null, null, "RESTAURANT", null, null, null, null))
            .thenReturn(Response.success(new PlaceSliceClientResponse(List.of(
                new PlaceItemClientResponse(
                    "31", null, "애월더선셋", "제주시 애월읍", 33.47, 126.33, null, null, null, true, "카페")),
                false)));

        List<PlaceCandidateQueryResult> results = adapter.findRestaurantCandidates("39", null, 50, PetAdmission.ANY);

        assertThat(results).singleElement().satisfies(place -> {
            assertThat(place.placeId()).isEqualTo(31L);
            assertThat(place.sourceCategory()).isEqualTo("카페");
        });
    }

    @Test
    @DisplayName("거리순 조회는 기준점 lat · lng 를 함께 넘기고 시군구는 걸지 않는다 (#1312)")
    void passesAnchorForNearbyLookups() {
        PlaceCandidateClientAdapter adapter = adapter();
        when(placeCandidateClient.searchPlaces("39", null, "ALLOWED", 50, null, null, null, 33.33, 126.80, null, null))
            .thenReturn(Response.success(new PlaceSliceClientResponse(List.of(
                new PlaceItemClientResponse(
                    "41", null, "표선해수욕장", "서귀포시 표선면", 33.326, 126.842, null, null, null, false, null)),
                false)));
        when(placeCandidateClient.searchPlaces("39", null, "ALLOWED", 50, null, null, "LODGING", 33.33, 126.80, null, null))
            .thenReturn(Response.success(new PlaceSliceClientResponse(List.of(), false)));
        when(placeCandidateClient.searchPlaces("39", null, "ALLOWED", 50, null, null, "RESTAURANT", 33.33, 126.80, null, null))
            .thenReturn(Response.success(new PlaceSliceClientResponse(List.of(), false)));

        assertThat(adapter.findNearbyCandidates("39", 33.33, 126.80, 50, PetAdmission.ANY))
            .singleElement().satisfies(place -> assertThat(place.placeId()).isEqualTo(41L));
        assertThat(adapter.findNearbyLodgingCandidates("39", 33.33, 126.80, 50, PetAdmission.ANY)).isEmpty();
        assertThat(adapter.findNearbyRestaurantCandidates("39", 33.33, 126.80, 50, PetAdmission.ANY)).isEmpty();
    }

    @Test
    @DisplayName("동행견 입장 기준을 검색 필터 petSizeType · petWeightKg 로 넘기고 입장 크기 code 를 enum 으로 읽는다 (#1420)")
    void passesPetAdmissionAndReadsAllowedPetSizeCode() {
        PlaceCandidateClientAdapter adapter = adapter();
        // 가장 큰 크기(MEDIUM)와 가장 무거운 유효 체중(보리의 중형견 하한 10kg)이 나간다
        when(placeCandidateClient.searchPlaces("39", null, "ALLOWED", 50, null, null, "LODGING", null, null, "MEDIUM", 10))
            .thenReturn(Response.success(new PlaceSliceClientResponse(List.of(
                new PlaceItemClientResponse("51", null, "중소형견 펜션", "제주시", 33.5, 126.5, null,
                    new MetadataClientResponse("SMALL_MEDIUM", "중소형견 가능", "소형견과 중형견까지 동반이 가능합니다."),
                    15, true, "펜션")),
                false)));

        List<PlaceCandidateQueryResult> results = adapter.findLodgingCandidates("39", null, 50, BORI_AND_MONGSIL);

        assertThat(results).singleElement().satisfies(place -> {
            assertThat(place.allowedPetSize()).isEqualTo(AllowedPetSize.SMALL_MEDIUM);
            assertThat(place.maxPetWeightKg()).isEqualTo(15);
        });
    }

    @Test
    @DisplayName("거리순 조회에도 입장 기준을 같은 필터로 넘긴다 — tour-service 는 거리순에도 같은 필터를 건다 (#1420)")
    void passesPetAdmissionForNearbyLookups() {
        PlaceCandidateClientAdapter adapter = adapter();
        // 몽실이 혼자면 SMALL · 3.2kg 의 올림 4kg 이 나간다 — 상한이 정수라 올림이 정확하다
        when(placeCandidateClient.searchPlaces("39", null, "ALLOWED", 50, null, null, null, 33.33, 126.80, "SMALL", 4))
            .thenReturn(Response.success(new PlaceSliceClientResponse(List.of(
                new PlaceItemClientResponse("71", null, "협재해수욕장", "제주시 한림읍", 33.394, 126.239, null, null, null, false, null)),
                false)));

        // 인자가 하나라도 다르면 스텁이 맞지 않아 빈 목록이 된다 — lenient 로 바뀌어도 이 단언이 잡는다
        assertThat(adapter.findNearbyCandidates("39", 33.33, 126.80, 50, admissionOf("3.2")))
            .singleElement().satisfies(place -> assertThat(place.placeId()).isEqualTo(71L));
        verify(placeCandidateClient).searchPlaces("39", null, "ALLOWED", 50, null, null, null, 33.33, 126.80, "SMALL", 4);
    }

    @Test
    @DisplayName("검색 체중은 유효 체중의 올림을 tour-service 범위(1~100)로 자른 값이다 — 상한이 정수라 올림이 정확하고, 넘으면 400 이 난다 (#1420)")
    void convertsEffectiveWeightToSearchParam() {
        PlaceCandidateClientAdapter adapter = adapter();
        when(placeCandidateClient.searchPlaces(
            eq("39"), isNull(), eq("ALLOWED"), eq(20), isNull(), isNull(), isNull(), isNull(), isNull(), any(), any()))
            .thenReturn(Response.success(new PlaceSliceClientResponse(List.of(), false)));

        for (String weightKg : List.of("3.2", "7.0", "0.4", "120")) {
            adapter.findPetFriendlyCandidates("39", null, 20, admissionOf(weightKg));
        }
        adapter.findPetFriendlyCandidates("39", null, 20, BORI_AND_MONGSIL);
        adapter.findPetFriendlyCandidates("39", null, 20, PetAdmission.ANY);

        // 3.2 → 4 (내림하면 상한 3kg 이 샌다) · 7.0 → 7 (경계 그대로)
        verify(placeCandidateClient).searchPlaces("39", null, "ALLOWED", 20, null, null, null, null, null, "SMALL", 4);
        verify(placeCandidateClient).searchPlaces("39", null, "ALLOWED", 20, null, null, null, null, null, "SMALL", 7);
        // 0.4 → 1 · 120 → 100 — tour-service 의 @Min(1) @Max(100). 100 초과는 워커의 메모리 판정이 실제 체중으로 다시 거른다
        verify(placeCandidateClient).searchPlaces("39", null, "ALLOWED", 20, null, null, null, null, null, "SMALL", 1);
        verify(placeCandidateClient).searchPlaces("39", null, "ALLOWED", 20, null, null, null, null, null, "LARGE", 100);
        // 보리(체중 미상 → 중형견 하한 10kg) + 몽실이 3.2kg → 가장 큰 크기 · 가장 무거운 유효 체중
        verify(placeCandidateClient).searchPlaces("39", null, "ALLOWED", 20, null, null, null, null, null, "MEDIUM", 10);
        // 반려견 정보가 없으면 조건을 걸지 않는다
        verify(placeCandidateClient).searchPlaces("39", null, "ALLOWED", 20, null, null, null, null, null, null, null);
    }

    @Test
    @DisplayName("모르는 입장 크기 code 는 null 로 둔다 — 제한 정보 없음으로 읽혀 막지 않는다 (#1420)")
    void unknownAllowedPetSizeCodeBecomesNull() {
        PlaceCandidateClientAdapter adapter = adapter();
        when(placeCandidateClient.searchPlaces("39", null, "ALLOWED", 20, null, null, null, null, null, null, null))
            .thenReturn(Response.success(new PlaceSliceClientResponse(List.of(
                new PlaceItemClientResponse("61", null, "새 장소", "제주시", 33.5, 126.5, null,
                    new MetadataClientResponse("TINY_ONLY", "초소형견만", null), null, false, null),
                new PlaceItemClientResponse("62", null, "정보 없음", "제주시", 33.5, 126.5, null, null, null, false, null)),
                false)));

        assertThat(adapter.findPetFriendlyCandidates("39", null, 20, PetAdmission.ANY))
            .extracting(PlaceCandidateQueryResult::allowedPetSize)
            .containsExactly(null, null);
    }

    @Test
    @DisplayName("아이디 조회는 입장 크기 표시명을 enum 으로 되돌린다 — 이 경로는 표시명만 온다 (#1420)")
    void mapsDisplayNameBackToAllowedPetSize() {
        PlaceCandidateClientAdapter adapter = adapter();
        when(pinnedPlaceCandidateClient.getCandidates(List.of(126455L, 2L, 3L, 4L)))
            .thenReturn(Response.success(List.of(
                internal(126455L, "한림공원", "소형견만 가능", 7),
                internal(2L, "어디든", "전 견종 가능", null),
                internal(3L, "모르는 표시", "초소형견만", null),
                internal(4L, "빈 표시", " ", null))));

        List<PlaceCandidateQueryResult> results = adapter.findCandidatesByIds(List.of(126455L, 2L, 3L, 4L));

        assertThat(results).extracting(PlaceCandidateQueryResult::allowedPetSize)
            .containsExactly(AllowedPetSize.SMALL_ONLY, AllowedPetSize.ALL, null, null);
        assertThat(results.get(0).maxPetWeightKg()).isEqualTo(7);
    }

    private PlaceCandidateClientAdapter adapter() {
        return new PlaceCandidateClientAdapter(
            placeCandidateClient,
            pinnedPlaceCandidateClient,
            new InternalResponseSupport(CircuitBreakerRegistry.ofDefaults()));
    }

    /** 크기 없이 체중만 아는 한 마리 — 크기는 체중으로 얻는다(3.2kg 은 SMALL, 120kg 은 LARGE). */
    private static PetAdmission admissionOf(String weightKg) {
        return PetAdmission.of(List.of(PetCondition.builder().weightKg(new BigDecimal(weightKg)).build()));
    }

    private static PlaceCandidateInternalClientResponse internal(
        long placeId, String title, String allowedPetSizeName, Integer maxPetWeightKg
    ) {
        return new PlaceCandidateInternalClientResponse(
            placeId, title, "관광지", "제주시 한림읍", "동반 가능", allowedPetSizeName, maxPetWeightKg, false, null, 33.39, 126.24);
    }
}
