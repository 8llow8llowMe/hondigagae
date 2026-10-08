package com.hondigagae.domainlayer.placeimport.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceMergeCommandPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlaceMergeCandidateQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceContentType;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceSourceType;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class PlaceMergeProcessorTest {

    private static final String AREA_CODE = "39";
    /** 제주시 기준점. 위도 0.001° ≈ 111m 라서 아래 오프셋으로 거리를 만든다. */
    private static final BigDecimal BASE_LAT = new BigDecimal("33.499600");
    private static final BigDecimal BASE_LNG = new BigDecimal("126.531200");
    private static final String TOURIST_SPOT = PlaceContentType.TOURIST_SPOT.getCode();
    private static final String CULTURE = PlaceContentType.CULTURE.getCode();
    private static final String LEPORTS = PlaceContentType.LEPORTS.getCode();
    private static final String LODGING = PlaceContentType.LODGING.getCode();

    private final PlaceMergeCommandPort placeMergeCommandPort = mock(PlaceMergeCommandPort.class);
    private final PlaceMergeProcessor processor = new PlaceMergeProcessor(placeMergeCommandPort);

    @Test
    @DisplayName("이름이 같은 문화정보원 행만 관광 API 행에 흡수시킨다")
    void mergesOnlyTheSameNamedCandidate() {
        PlaceMergeCandidateQueryResult survivor = candidate(1L, PlaceSourceType.TOUR_API, "노리매공원", 0d);
        // 이름 완전일치 + 500m → 병합 (완전일치 반경 1,000m 안)
        PlaceMergeCandidateQueryResult sameName = candidate(2L, PlaceSourceType.CULTURE_PORTAL, "노리매공원", 0.0045d);
        // 이름이 다르면 50m 라도 병합하지 않는다
        PlaceMergeCandidateQueryResult otherName = candidate(3L, PlaceSourceType.CULTURE_PORTAL, "쉼한모금", 0.00045d);
        when(placeMergeCommandPort.findMergeCandidates(AREA_CODE))
            .thenReturn(List.of(survivor, sameName, otherName));
        List<long[]> merged = capturePairs();

        int result = processor.mergeDuplicates(AREA_CODE);

        assertThat(result).isEqualTo(1);
        assertThat(merged).hasSize(1);
        assertThat(merged.get(0)).containsExactly(2L, 1L);
    }

    @Test
    @DisplayName("조건을 만족하는 관광 API 행이 둘이면 조회 순서와 무관하게 이름 완전일치 쪽에 붙인다")
    void prefersExactNameOverPartialName() {
        // 부분일치 행이 더 가깝고 조회 순서도 먼저지만, 완전일치가 같은 곳이라는 근거가 더 강하다.
        PlaceMergeCandidateQueryResult partial = candidate(1L, PlaceSourceType.TOUR_API, "노리매", 0.0002d);
        PlaceMergeCandidateQueryResult exact = candidate(2L, PlaceSourceType.TOUR_API, "노리매공원", 0.002d);
        PlaceMergeCandidateQueryResult absorbable = candidate(3L, PlaceSourceType.CULTURE_PORTAL, "노리매공원", 0d);
        when(placeMergeCommandPort.findMergeCandidates(AREA_CODE)).thenReturn(List.of(partial, exact, absorbable));
        List<long[]> merged = capturePairs();

        processor.mergeDuplicates(AREA_CODE);

        assertThat(merged).hasSize(1);
        assertThat(merged.get(0)).containsExactly(3L, 2L);
    }

    @Test
    @DisplayName("이름 판정이 같은 등급이면 가까운 관광 API 행에 붙인다")
    void prefersNearerSurvivorWithinSameNameMatch() {
        PlaceMergeCandidateQueryResult far = candidate(1L, PlaceSourceType.TOUR_API, "서우봉", 0.008d);
        PlaceMergeCandidateQueryResult near = candidate(2L, PlaceSourceType.TOUR_API, "서우봉", 0.001d);
        PlaceMergeCandidateQueryResult absorbable = candidate(3L, PlaceSourceType.CULTURE_PORTAL, "서우봉", 0d);
        when(placeMergeCommandPort.findMergeCandidates(AREA_CODE)).thenReturn(List.of(far, near, absorbable));
        List<long[]> merged = capturePairs();

        processor.mergeDuplicates(AREA_CODE);

        assertThat(merged).hasSize(1);
        assertThat(merged.get(0)).containsExactly(3L, 2L);
    }

    @Test
    @DisplayName("이름이 공통 부분으로만 겹쳐도 100m 안이면 병합한다 — 도치돌목장 · 도치돌 알파카목장")
    void mergesSharedCoreNameWithinOneHundredMeters() {
        PlaceMergeCandidateQueryResult survivor = candidate(1L, PlaceSourceType.TOUR_API, "도치돌 알파카목장", 0.00089d);
        PlaceMergeCandidateQueryResult absorbable = candidate(2L, PlaceSourceType.CULTURE_PORTAL, "도치돌목장", 0d);
        when(placeMergeCommandPort.findMergeCandidates(AREA_CODE)).thenReturn(List.of(survivor, absorbable));
        List<long[]> merged = capturePairs();

        processor.mergeDuplicates(AREA_CODE);

        assertThat(merged).hasSize(1);
        assertThat(merged.get(0)).containsExactly(2L, 1L);
    }

    @Test
    @DisplayName("코스 행에는 흡수시키지 않고 같은 이름의 장소 행에 붙인다 — 김만덕기념관")
    void neverAbsorbsIntoCourseRow() {
        // dev 실측: 코스 이름이 지나는 장소 이름을 품어 부분일치에 걸렸고, 기념관이 올레 코스에 흡수됐었다.
        PlaceMergeCandidateQueryResult course = candidate(
            1L, PlaceSourceType.TOUR_API, "[제주올레 18코스] 김만덕기념관-조천 올레", LEPORTS, 0d);
        PlaceMergeCandidateQueryResult hall = candidate(2L, PlaceSourceType.TOUR_API, "김만덕기념관", CULTURE, 0.004d);
        PlaceMergeCandidateQueryResult absorbable = candidate(3L, PlaceSourceType.CULTURE_PORTAL, "김만덕기념관", CULTURE, 0d);
        when(placeMergeCommandPort.findMergeCandidates(AREA_CODE)).thenReturn(List.of(course, hall, absorbable));
        List<long[]> merged = capturePairs();

        processor.mergeDuplicates(AREA_CODE);

        assertThat(merged).hasSize(1);
        assertThat(merged.get(0)).containsExactly(3L, 2L);
    }

    @Test
    @DisplayName("이름이 겹치는 관광 API 행이 코스 행뿐이면 병합하지 않는다")
    void neverAbsorbsIntoCourseRowEvenWhenItIsTheOnlyCandidate() {
        // 위 테스트는 완전일치 행이 있어 순위만으로도 같은 답이 나온다. 코스 가드 자체를 여기서 고정한다.
        PlaceMergeCandidateQueryResult course = candidate(
            1L, PlaceSourceType.TOUR_API, "[제주올레 18코스] 김만덕기념관-조천 올레", LEPORTS, 0d);
        PlaceMergeCandidateQueryResult absorbable = candidate(2L, PlaceSourceType.CULTURE_PORTAL, "김만덕기념관", CULTURE, 0d);
        when(placeMergeCommandPort.findMergeCandidates(AREA_CODE)).thenReturn(List.of(course, absorbable));

        assertThat(processor.mergeDuplicates(AREA_CODE)).isZero();

        verify(placeMergeCommandPort, never()).markMerged(any());
    }

    @Test
    @DisplayName("숙박과 숙박 아닌 곳은 이름이 겹쳐도 병합하지 않는다 — 제주양떼목장펜션 · 제주양떼목장")
    void neverMergesLodgingWithNonLodging() {
        PlaceMergeCandidateQueryResult farm = candidate(1L, PlaceSourceType.TOUR_API, "제주양떼목장", TOURIST_SPOT, 0.00014d);
        PlaceMergeCandidateQueryResult pension = candidate(2L, PlaceSourceType.CULTURE_PORTAL, "제주양떼목장펜션", LODGING, 0d);
        when(placeMergeCommandPort.findMergeCandidates(AREA_CODE)).thenReturn(List.of(farm, pension));

        assertThat(processor.mergeDuplicates(AREA_CODE)).isZero();

        verify(placeMergeCommandPort, never()).markMerged(any());
    }

    @Test
    @DisplayName("후보가 비면 병합 표시를 부르지 않는다")
    void skipsWhenNoCandidate() {
        when(placeMergeCommandPort.findMergeCandidates(anyString())).thenReturn(List.of());

        assertThat(processor.mergeDuplicates(AREA_CODE)).isZero();

        verify(placeMergeCommandPort, never()).markMerged(any());
    }

    @Test
    @DisplayName("좌표가 없는 행은 이름이 같아도 병합하지 않는다 — 거리를 확인할 수 없다")
    void skipsCandidateWithoutCoordinate() {
        PlaceMergeCandidateQueryResult survivor =
            new PlaceMergeCandidateQueryResult(1L, PlaceSourceType.TOUR_API.name(), "노리매공원", TOURIST_SPOT, null, null);
        PlaceMergeCandidateQueryResult absorbable =
            candidate(2L, PlaceSourceType.CULTURE_PORTAL, "노리매공원", 0d);
        when(placeMergeCommandPort.findMergeCandidates(AREA_CODE)).thenReturn(List.of(survivor, absorbable));

        assertThat(processor.mergeDuplicates(AREA_CODE)).isZero();

        verify(placeMergeCommandPort, never()).markMerged(any());
    }

    /** markMerged 로 넘어간 (흡수될 id, 살아남을 id) 쌍을 그대로 담아 둔다. */
    private List<long[]> capturePairs() {
        List<long[]> captured = new ArrayList<>();
        when(placeMergeCommandPort.markMerged(anyList())).thenAnswer(invocation -> {
            List<long[]> pairs = invocation.getArgument(0);
            captured.addAll(pairs);
            return captured.size();
        });
        return captured;
    }

    private PlaceMergeCandidateQueryResult candidate(
        long id, PlaceSourceType source, String title, double latOffset
    ) {
        return candidate(id, source, title, TOURIST_SPOT, latOffset);
    }

    private PlaceMergeCandidateQueryResult candidate(
        long id, PlaceSourceType source, String title, String contentTypeId, double latOffset
    ) {
        return new PlaceMergeCandidateQueryResult(
            id, source.name(), title, contentTypeId, BASE_LAT.add(BigDecimal.valueOf(latOffset)), BASE_LNG);
    }
}
