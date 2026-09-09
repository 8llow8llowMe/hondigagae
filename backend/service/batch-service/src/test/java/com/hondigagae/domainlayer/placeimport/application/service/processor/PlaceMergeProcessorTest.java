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
            new PlaceMergeCandidateQueryResult(1L, PlaceSourceType.TOUR_API.name(), "노리매공원", null, null);
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
        return new PlaceMergeCandidateQueryResult(
            id, source.name(), title, BASE_LAT.add(BigDecimal.valueOf(latOffset)), BASE_LNG);
    }
}
