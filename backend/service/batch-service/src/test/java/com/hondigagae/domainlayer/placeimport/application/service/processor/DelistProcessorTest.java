package com.hondigagae.domainlayer.placeimport.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.hondigagae.domainlayer.placeimport.application.model.PlaceImportOutcome;
import com.hondigagae.domainlayer.placeimport.application.port.out.EmergencyFacilityDelistCommandPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceDelistCommandPort;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceContentType;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceSourceType;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * delist 범위가 적재 범위와 같은지 고정한다 (#726).
 *
 * <p>적재는 (지역, contentType) 단위로 도는데 delist 는 지역까지만 봤다. 그 비대칭 때문에
 * 한 타입이 0건으로 들어온 실행 하나가 그 타입의 기존 행을 전부 내릴 수 있었다.
 *
 * <p><b>"하나라도 0건이면 전체를 건너뛴다"는 답이 아니다.</b> 여행코스(25)는 지역 키와 무관하게
 * 늘 0건이라 그러면 delist 가 영영 돌지 않는다. 그래서 <b>0건인 타입만 범위에서 빼고</b>
 * 나머지는 정상적으로 내린다.
 */
@ExtendWith(MockitoExtension.class)
class DelistProcessorTest {

    private static final String AREA_CODE = "39";
    private static final LocalDateTime RUN_STARTED_AT = LocalDateTime.of(2026, 9, 19, 3, 0);

    @Mock
    private PlaceDelistCommandPort placeDelistCommandPort;

    @Mock
    private EmergencyFacilityDelistCommandPort emergencyFacilityDelistCommandPort;

    @InjectMocks
    private DelistProcessor delistProcessor;

    @Captor
    private ArgumentCaptor<Collection<String>> countScopeCaptor;

    @Captor
    private ArgumentCaptor<Collection<String>> delistScopeCaptor;

    private PlaceImportOutcome outcome(Map<PlaceContentType, Integer> byContentType) {
        return new PlaceImportOutcome(byContentType);
    }

    /** 여행코스(25)만 0건이고 나머지 6종은 정상인, 앞으로 매주 보게 될 상태. */
    private PlaceImportOutcome outcomeWithEmptyCourse() {
        Map<PlaceContentType, Integer> byContentType = new LinkedHashMap<>();
        byContentType.put(PlaceContentType.TOURIST_SPOT, 560);
        byContentType.put(PlaceContentType.CULTURE, 98);
        byContentType.put(PlaceContentType.COURSE, 0);
        byContentType.put(PlaceContentType.LEPORTS, 137);
        byContentType.put(PlaceContentType.LODGING, 210);
        byContentType.put(PlaceContentType.SHOPPING, 395);
        byContentType.put(PlaceContentType.RESTAURANT, 699);
        return outcome(byContentType);
    }

    @Test
    @DisplayName("0건인 타입만 범위에서 빠지고 나머지 타입의 delist 는 정상 수행된다")
    void delistsEveryContentTypeButTheEmptyOne() {
        given(placeDelistCommandPort.countActiveByContentType(anyString(), anyString(), any())).willReturn(Map.of());
        given(placeDelistCommandPort.countActive(anyString(), anyString(), any())).willReturn(2_100L);
        given(placeDelistCommandPort.delistStale(anyString(), anyString(), any(), any())).willReturn(11);

        int delisted = delistProcessor.delistPlacesByContentType(
            PlaceSourceType.TOUR_API, AREA_CODE, RUN_STARTED_AT, outcomeWithEmptyCourse());

        assertThat(delisted).isEqualTo(11);
        verify(placeDelistCommandPort).delistStale(eq(PlaceSourceType.TOUR_API.name()), eq(AREA_CODE),
            delistScopeCaptor.capture(), eq(RUN_STARTED_AT));
        // 여행코스(25)만 빠지고 나머지 6종은 그대로 내려간다 — 전체 스킵이 아니다.
        assertThat(delistScopeCaptor.getValue())
            .containsExactly("12", "14", "28", "32", "38", "39")
            .doesNotContain(PlaceContentType.COURSE.getCode());
    }

    @Test
    @DisplayName("활성 건수와 delist 대상이 같은 타입 집합을 받는다 — 범위가 어긋나면 급감 가드가 무의미하다")
    void countsActiveWithTheSameContentTypeScope() {
        given(placeDelistCommandPort.countActiveByContentType(anyString(), anyString(), any())).willReturn(Map.of());
        given(placeDelistCommandPort.countActive(anyString(), anyString(), any())).willReturn(2_100L);
        given(placeDelistCommandPort.delistStale(anyString(), anyString(), any(), any())).willReturn(0);

        delistProcessor.delistPlacesByContentType(
            PlaceSourceType.TOUR_API, AREA_CODE, RUN_STARTED_AT, outcomeWithEmptyCourse());

        verify(placeDelistCommandPort).countActive(anyString(), anyString(), countScopeCaptor.capture());
        verify(placeDelistCommandPort).delistStale(anyString(), anyString(), delistScopeCaptor.capture(), any());
        assertThat(countScopeCaptor.getValue()).isEqualTo(delistScopeCaptor.getValue());
    }

    @Test
    @DisplayName("전 타입 0건이면 delist 를 아예 호출하지 않는다 — 빈 범위를 SQL 로 내려보내지 않는다")
    void skipsDelistWhenNoContentTypeImported() {
        Map<PlaceContentType, Integer> byContentType = new LinkedHashMap<>();
        PlaceContentType.DEFAULT_IMPORT_TARGETS.forEach(contentType -> byContentType.put(contentType, 0));
        given(placeDelistCommandPort.countActiveByContentType(anyString(), anyString(), any())).willReturn(Map.of());

        int delisted = delistProcessor.delistPlacesByContentType(
            PlaceSourceType.TOUR_API, AREA_CODE, RUN_STARTED_AT, outcome(byContentType));

        assertThat(delisted).isZero();
        verify(placeDelistCommandPort, never()).countActive(anyString(), anyString(), any());
        verify(placeDelistCommandPort, never()).delistStale(anyString(), anyString(), any(), any());
    }

    @Test
    @DisplayName("0건인 타입의 활성 행 수는 타입별 한 번의 조회로 확인한다 — 진짜 이상 신호를 로그로 남기기 위해")
    void looksUpActiveRowsOfEmptyContentTypesInOneQuery() {
        // 여행코스는 원래 0건이라 활성 행도 0, 쇼핑은 활성 행이 남아 있는데 0건으로 들어온 상태다.
        Map<PlaceContentType, Integer> byContentType = new LinkedHashMap<>();
        byContentType.put(PlaceContentType.TOURIST_SPOT, 560);
        byContentType.put(PlaceContentType.COURSE, 0);
        byContentType.put(PlaceContentType.SHOPPING, 0);
        given(placeDelistCommandPort.countActiveByContentType(anyString(), anyString(), any()))
            .willReturn(Map.of(PlaceContentType.SHOPPING.getCode(), 395L));
        given(placeDelistCommandPort.countActive(anyString(), anyString(), any())).willReturn(560L);
        given(placeDelistCommandPort.delistStale(anyString(), anyString(), any(), any())).willReturn(0);

        delistProcessor.delistPlacesByContentType(
            PlaceSourceType.TOUR_API, AREA_CODE, RUN_STARTED_AT, outcome(byContentType));

        // 타입마다 세지 않는다 — 0건 타입 전부를 한 번에 묻는다.
        verify(placeDelistCommandPort).countActiveByContentType(eq(PlaceSourceType.TOUR_API.name()), eq(AREA_CODE),
            countScopeCaptor.capture());
        assertThat(countScopeCaptor.getValue())
            .containsExactly(PlaceContentType.COURSE.getCode(), PlaceContentType.SHOPPING.getCode());
        // 0건인 타입은 delist 범위에서 빠진다 — 활성 행이 남아 있어도 자동으로 내리지 않는다.
        verify(placeDelistCommandPort).delistStale(anyString(), anyString(), delistScopeCaptor.capture(), any());
        assertThat(delistScopeCaptor.getValue()).containsExactly(PlaceContentType.TOURIST_SPOT.getCode());
    }

    @Test
    @DisplayName("급감 가드에 걸리면 delist 를 건너뛴다 — 타입 범위를 좁혀도 이 가드는 그대로다")
    void skipsDelistWhenGuardRejects() {
        Map<PlaceContentType, Integer> byContentType = new LinkedHashMap<>();
        byContentType.put(PlaceContentType.TOURIST_SPOT, 100);
        given(placeDelistCommandPort.countActive(anyString(), anyString(), any())).willReturn(1_000L);

        int delisted = delistProcessor.delistPlacesByContentType(
            PlaceSourceType.TOUR_API, AREA_CODE, RUN_STARTED_AT, outcome(byContentType));

        assertThat(delisted).isZero();
        verify(placeDelistCommandPort, never()).delistStale(anyString(), anyString(), any(), any());
    }

    @Test
    @DisplayName("타입 단위로 나뉘지 않는 원천은 타입 범위 없이(null) 돈다 — 문화정보원·식약처")
    void delistsWholeSourceWhenNotPartitionedByContentType() {
        given(placeDelistCommandPort.countActive(anyString(), anyString(), any())).willReturn(900L);
        given(placeDelistCommandPort.delistStale(anyString(), anyString(), any(), any())).willReturn(3);

        int delisted = delistProcessor.delistPlaces(PlaceSourceType.MFDS, AREA_CODE, RUN_STARTED_AT, 880);

        assertThat(delisted).isEqualTo(3);
        verify(placeDelistCommandPort).countActive(eq(PlaceSourceType.MFDS.name()), eq(AREA_CODE), eq(null));
        verify(placeDelistCommandPort).delistStale(eq(PlaceSourceType.MFDS.name()), eq(AREA_CODE), eq(null),
            eq(RUN_STARTED_AT));
    }
}
