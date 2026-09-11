package com.hondigagae.domainlayer.placeimport.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportErrorCode;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportException;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceCatalogPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceIntroBulkPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlaceIntroTargetQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceContentType;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlaceIntro;
import com.hondigagae.global.properties.PlaceIntroImportProperties;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/**
 * detailIntro2 적재 프로세서 검증.
 *
 * <p>호출 간 대기가 200ms 라 대상 수를 1~3곳으로 작게 유지한다 — 실행 시간을 위해 프로세서의
 * 설계(고정 대기)를 비틀지 않는다.
 */
class PlaceIntroImportProcessorTest {

    private static final int MAX_CALLS = 7;

    private final PlaceCatalogPort placeCatalogPort = mock(PlaceCatalogPort.class);
    private final PlaceIntroBulkPort placeIntroBulkPort = mock(PlaceIntroBulkPort.class);
    private final PlaceIntroImportProcessor processor = new PlaceIntroImportProcessor(
        placeCatalogPort, placeIntroBulkPort, new PlaceIntroImportProperties(MAX_CALLS));

    @Test
    @DisplayName("실행당 상한과 운영시간 보유 타입 목록을 그대로 조회 포트에 넘긴다")
    void passesRunLimitAndTargetTypesToQueryPort() {
        when(placeIntroBulkPort.findTourApiTargets(anyList(), anyInt())).thenReturn(List.of());

        assertThat(processor.importIntros()).isZero();

        ArgumentCaptor<List<PlaceContentType>> contentTypes = ArgumentCaptor.captor();
        verify(placeIntroBulkPort).findTourApiTargets(contentTypes.capture(), eq(MAX_CALLS));
        // 숙박(32)·여행코스(25)·축제(15)는 detailIntro2 에 운영시간 필드가 없어 빠진다
        assertThat(contentTypes.getValue()).containsExactly(
            PlaceContentType.TOURIST_SPOT, PlaceContentType.CULTURE, PlaceContentType.LEPORTS,
            PlaceContentType.SHOPPING, PlaceContentType.RESTAURANT);
    }

    @Test
    @DisplayName("한 곳이 실패해도 나머지는 계속 적재한다 — 보강 데이터라 한 곳 때문에 멈추면 손해가 크다")
    void oneFailureDoesNotStopTheRest() {
        when(placeIntroBulkPort.findTourApiTargets(anyList(), anyInt()))
            .thenReturn(List.of(target(1L, 100L, "12"), target(2L, 200L, "39")));
        when(placeCatalogPort.fetchDetailIntro(eq(100L), any()))
            .thenThrow(new PlaceImportException(PlaceImportErrorCode.TOUR_API_CALL_FAILED, "HTTP 500"));
        when(placeCatalogPort.fetchDetailIntro(eq(200L), any())).thenReturn(Optional.of(intro("11:00~21:00")));

        assertThat(processor.importIntros()).isEqualTo(1);

        verify(placeIntroBulkPort, never()).upsert(eq(1L), any());
        verify(placeIntroBulkPort).upsert(eq(2L), any());
        // 실패한 곳도 순환에 넣는다 — 그러지 않으면 영영 실패하는 장소가 매 실행 앞자리를
        // 차지해 예산만 태운다. 내용은 건드리지 않으므로 한 바퀴 뒤 재시도된다.
        verify(placeIntroBulkPort).touchSyncedAt(1L);
    }

    @Test
    @DisplayName("일일 한도 초과는 즉시 전파하고 synced_at 을 밀지 않는다 — 같은 잡의 이미지 스텝 때문에 이것이 정상 경로다")
    void quotaExceededStopsTheStepWithoutTouching() {
        when(placeIntroBulkPort.findTourApiTargets(anyList(), anyInt()))
            .thenReturn(List.of(target(1L, 100L, "12"), target(2L, 200L, "39")));
        when(placeCatalogPort.fetchDetailIntro(anyLong(), any()))
            .thenThrow(new PlaceImportException(PlaceImportErrorCode.TOUR_API_QUOTA_EXCEEDED, "22 …"));

        assertThatThrownBy(processor::importIntros)
            .isInstanceOf(PlaceImportException.class)
            .hasMessageContaining(PlaceImportErrorCode.TOUR_API_QUOTA_EXCEEDED.getCode());

        // 한도 초과를 한 곳 실패로 접으면 상한만큼의 장소가 전부 뒤로 밀려 다음 실행에서도 비어 있다
        verify(placeCatalogPort, times(1)).fetchDetailIntro(anyLong(), any());
        verify(placeIntroBulkPort, never()).touchSyncedAt(anyLong());
    }

    @Test
    @DisplayName("서비스 키 누락도 즉시 전파한다 — 남은 대상을 다 돌아도 결과가 같다")
    void missingServiceKeyStopsTheStepImmediately() {
        when(placeIntroBulkPort.findTourApiTargets(anyList(), anyInt()))
            .thenReturn(List.of(target(1L, 100L, "12"), target(2L, 200L, "39")));
        when(placeCatalogPort.fetchDetailIntro(anyLong(), any()))
            .thenThrow(new PlaceImportException(PlaceImportErrorCode.TOUR_API_SERVICE_KEY_MISSING));

        assertThatThrownBy(processor::importIntros)
            .isInstanceOf(PlaceImportException.class)
            .hasMessageContaining(PlaceImportErrorCode.TOUR_API_SERVICE_KEY_MISSING.getCode());

        // 키가 없는 실행이 300곳의 synced_at 을 밀어 순환을 헝클어뜨리면 안 된다
        verify(placeCatalogPort, times(1)).fetchDetailIntro(anyLong(), any());
        verify(placeIntroBulkPort, never()).touchSyncedAt(anyLong());
    }

    @Test
    @DisplayName("서킷 오픈은 즉시 전파한다 — 원천이 죽었는데 남은 예산을 계속 태우지 않는다")
    void circuitOpenStopsTheStepImmediately() {
        when(placeIntroBulkPort.findTourApiTargets(anyList(), anyInt()))
            .thenReturn(List.of(target(1L, 100L, "12"), target(2L, 200L, "39")));
        when(placeCatalogPort.fetchDetailIntro(anyLong(), any()))
            .thenThrow(new PlaceImportException(PlaceImportErrorCode.TOUR_API_CIRCUIT_OPEN));

        assertThatThrownBy(processor::importIntros)
            .isInstanceOf(PlaceImportException.class)
            .hasMessageContaining(PlaceImportErrorCode.TOUR_API_CIRCUIT_OPEN.getCode());

        // 두 번째 장소는 시도조차 하지 않는다
        verify(placeCatalogPort, times(1)).fetchDetailIntro(anyLong(), any());
        verify(placeIntroBulkPort, never()).upsert(anyLong(), any());
    }

    @Test
    @DisplayName("원천에 intro 가 없는 곳은 내용을 덮지 않고 synced_at 만 민다 — 대상 선정을 막지 않기 위해서다")
    void emptyIntroTouchesSyncedAtInsteadOfOverwriting() {
        when(placeIntroBulkPort.findTourApiTargets(anyList(), anyInt()))
            .thenReturn(List.of(target(1L, 100L, "12")));
        when(placeCatalogPort.fetchDetailIntro(anyLong(), any())).thenReturn(Optional.empty());

        assertThat(processor.importIntros()).isZero();

        // 빈 행으로 덮으면 다른 경로가 채워 둔 값을 지운다. 그렇다고 아무것도 안 하면
        // "intro 없는 곳 먼저" 정렬에서 이 장소가 매 실행 앞자리를 차지해 예산을 먹는다.
        verify(placeIntroBulkPort, never()).upsert(anyLong(), any());
        verify(placeIntroBulkPort).touchSyncedAt(1L);
    }

    @Test
    @DisplayName("모르는 contentTypeId 는 호출하지 않고 건너뛴다 — 쿼터를 헛되게 쓰지 않는다")
    void unknownContentTypeIsSkippedWithoutCall() {
        when(placeIntroBulkPort.findTourApiTargets(anyList(), anyInt()))
            .thenReturn(List.of(target(1L, 100L, "99"), target(2L, 200L, "12")));
        when(placeCatalogPort.fetchDetailIntro(eq(200L), eq(PlaceContentType.TOURIST_SPOT)))
            .thenReturn(Optional.of(intro("09:00~18:00")));

        assertThat(processor.importIntros()).isEqualTo(1);

        verify(placeCatalogPort, never()).fetchDetailIntro(eq(100L), any());
        verify(placeIntroBulkPort).upsert(eq(2L), any());
    }

    private PlaceIntroTargetQueryResult target(long placeId, long contentId, String contentTypeId) {
        return new PlaceIntroTargetQueryResult(placeId, contentId, contentTypeId);
    }

    private ImportedPlaceIntro intro(String useTime) {
        return ImportedPlaceIntro.builder()
            .useTime(useTime)
            .weeklyHoursSpec("1234567:0900-1800")
            .open24(false)
            .build();
    }
}
