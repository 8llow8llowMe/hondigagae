package com.hondigagae.domainlayer.placeimport.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportErrorCode;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportException;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceCatalogPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlacePetInfoBulkPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PetTourSyncQueryResult;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PetTourSyncQueryResult.Entry;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlacePetInfoTargetQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlacePetInfo;
import com.hondigagae.global.properties.PetTourImportProperties;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/**
 * 반려동물 동반 조건 적재 프로세서 (#877).
 *
 * <p>호출 간 대기가 200ms 라 대상 수를 1~3곳으로 작게 유지한다 ({@link PlaceIntroImportProcessorTest} 와 같은 이유).
 */
class PetTourImportProcessorTest {

    private static final String JEJU = "39";
    private static final int MAX_CALLS = 7;

    private final PlaceCatalogPort placeCatalogPort = mock(PlaceCatalogPort.class);
    private final PlacePetInfoBulkPort placePetInfoBulkPort = mock(PlacePetInfoBulkPort.class);
    private final PetTourImportProcessor processor = new PetTourImportProcessor(
        placeCatalogPort, placePetInfoBulkPort, new PetTourImportProperties(MAX_CALLS));

    @Test
    @DisplayName("노출 contentId 만 대상 조회에 넘기고 실행당 상한을 그대로 준다 — 전량 2,099곳이 아니라 교집합에만 부른다")
    void passesShownContentIdsAndRunLimit() {
        syncReturns(page(List.of(new Entry(100L, true), new Entry(200L, true), new Entry(300L, false)), 1, 3));
        when(placePetInfoBulkPort.findTourApiTargets(anyCollection(), anyInt())).thenReturn(List.of());

        assertThat(processor.importPetTourInfos(JEJU)).isZero();

        ArgumentCaptor<Collection<Long>> shown = ArgumentCaptor.captor();
        verify(placePetInfoBulkPort).findTourApiTargets(shown.capture(), eq(MAX_CALLS));
        assertThat(shown.getValue()).containsExactly(100L, 200L);
        verify(placeCatalogPort, never()).fetchDetailPetTour(anyLong());
    }

    @Test
    @DisplayName("showflag=0 인 contentId 만 지운다 — 같은 id 가 노출로도 오면 지우지 않는다")
    void deletesOnlyExplicitlyWithdrawn() {
        syncReturns(page(List.of(new Entry(100L, true), new Entry(200L, false), new Entry(100L, false)), 1, 3));
        when(placePetInfoBulkPort.findTourApiTargets(anyCollection(), anyInt())).thenReturn(List.of());

        processor.importPetTourInfos(JEJU);

        ArgumentCaptor<Collection<Long>> withdrawn = ArgumentCaptor.captor();
        verify(placePetInfoBulkPort).deleteByContentIds(withdrawn.capture());
        assertThat(withdrawn.getValue()).containsExactly(200L);
    }

    @Test
    @DisplayName("동기화 목록은 totalCount 만큼 페이지를 넘겨 받는다")
    void pagesThroughSyncList() {
        when(placeCatalogPort.fetchPetTourSyncList(eq(JEJU), eq(1), anyInt()))
            .thenReturn(new PetTourSyncQueryResult(List.of(new Entry(100L, true)), 1, 1, 2));
        when(placeCatalogPort.fetchPetTourSyncList(eq(JEJU), eq(2), anyInt()))
            .thenReturn(new PetTourSyncQueryResult(List.of(new Entry(200L, true)), 2, 1, 2));
        when(placePetInfoBulkPort.findTourApiTargets(anyCollection(), anyInt())).thenReturn(List.of());

        processor.importPetTourInfos(JEJU);

        ArgumentCaptor<Collection<Long>> shown = ArgumentCaptor.captor();
        verify(placePetInfoBulkPort).findTourApiTargets(shown.capture(), anyInt());
        assertThat(shown.getValue()).containsExactly(100L, 200L);
        verify(placeCatalogPort, times(2)).fetchPetTourSyncList(eq(JEJU), anyInt(), anyInt());
    }

    @Test
    @DisplayName("totalCount 가 남아도 빈 페이지면 멈춘다 — 같은 빈 페이지를 반복해 부르지 않는다")
    void stopsOnEmptyPage() {
        when(placeCatalogPort.fetchPetTourSyncList(eq(JEJU), anyInt(), anyInt()))
            .thenReturn(new PetTourSyncQueryResult(List.of(), 1, 1000, 5000));

        processor.importPetTourInfos(JEJU);

        verify(placeCatalogPort, times(1)).fetchPetTourSyncList(eq(JEJU), anyInt(), anyInt());
    }

    @Test
    @DisplayName("동기화 목록이 실패하면 아무것도 쓰지 않고 실패한다 — 대상 없이 지울 것도 부를 것도 정할 수 없다")
    void syncFailureWritesNothing() {
        when(placeCatalogPort.fetchPetTourSyncList(eq(JEJU), anyInt(), anyInt()))
            .thenThrow(new PlaceImportException(PlaceImportErrorCode.TOUR_API_CALL_FAILED, "HTTP 500"));

        assertThatThrownBy(() -> processor.importPetTourInfos(JEJU)).isInstanceOf(PlaceImportException.class);

        verifyNoInteractions(placePetInfoBulkPort);
    }

    @Test
    @DisplayName("상세가 있으면 upsert, 비면 synced_at 만 민다 — 빈 응답이 지난 값을 지우지 않는다")
    void upsertsOrTouches() {
        syncReturns(page(List.of(new Entry(100L, true), new Entry(200L, true)), 1, 2));
        when(placePetInfoBulkPort.findTourApiTargets(anyCollection(), anyInt()))
            .thenReturn(List.of(new PlacePetInfoTargetQueryResult(1L, 100L), new PlacePetInfoTargetQueryResult(2L, 200L)));
        when(placeCatalogPort.fetchDetailPetTour(100L)).thenReturn(Optional.of(petInfo()));
        when(placeCatalogPort.fetchDetailPetTour(200L)).thenReturn(Optional.empty());

        assertThat(processor.importPetTourInfos(JEJU)).isEqualTo(1);

        verify(placePetInfoBulkPort).upsert(eq(1L), any());
        verify(placePetInfoBulkPort).touchSyncedAt(2L);
        verify(placePetInfoBulkPort, never()).upsert(eq(2L), any());
    }

    @Test
    @DisplayName("한 곳이 실패해도 나머지는 계속 적재하고 실패한 곳은 순환 뒤로 민다")
    void oneFailureDoesNotStopTheRest() {
        syncReturns(page(List.of(new Entry(100L, true), new Entry(200L, true)), 1, 2));
        when(placePetInfoBulkPort.findTourApiTargets(anyCollection(), anyInt()))
            .thenReturn(List.of(new PlacePetInfoTargetQueryResult(1L, 100L), new PlacePetInfoTargetQueryResult(2L, 200L)));
        when(placeCatalogPort.fetchDetailPetTour(100L))
            .thenThrow(new PlaceImportException(PlaceImportErrorCode.TOUR_API_CALL_FAILED, "HTTP 500"));
        when(placeCatalogPort.fetchDetailPetTour(200L)).thenReturn(Optional.of(petInfo()));

        assertThat(processor.importPetTourInfos(JEJU)).isEqualTo(1);

        verify(placePetInfoBulkPort).touchSyncedAt(1L);
        verify(placePetInfoBulkPort).upsert(eq(2L), any());
    }

    @Test
    @DisplayName("일일 한도 초과는 즉시 전파하고 synced_at 을 밀지 않는다")
    void quotaExceededStopsTheStepWithoutTouching() {
        syncReturns(page(List.of(new Entry(100L, true), new Entry(200L, true)), 1, 2));
        when(placePetInfoBulkPort.findTourApiTargets(anyCollection(), anyInt()))
            .thenReturn(List.of(new PlacePetInfoTargetQueryResult(1L, 100L), new PlacePetInfoTargetQueryResult(2L, 200L)));
        when(placeCatalogPort.fetchDetailPetTour(anyLong()))
            .thenThrow(new PlaceImportException(PlaceImportErrorCode.TOUR_API_QUOTA_EXCEEDED, "22 …"));

        assertThatThrownBy(() -> processor.importPetTourInfos(JEJU))
            .isInstanceOf(PlaceImportException.class)
            .hasMessageContaining(PlaceImportErrorCode.TOUR_API_QUOTA_EXCEEDED.getCode());

        verify(placeCatalogPort, times(1)).fetchDetailPetTour(anyLong());
        verify(placePetInfoBulkPort, never()).touchSyncedAt(anyLong());
    }

    private void syncReturns(PetTourSyncQueryResult result) {
        when(placeCatalogPort.fetchPetTourSyncList(eq(JEJU), anyInt(), anyInt())).thenReturn(result);
    }

    private static PetTourSyncQueryResult page(List<Entry> entries, int pageNo, int totalCount) {
        return new PetTourSyncQueryResult(entries, pageNo, PetTourImportProcessor.SYNC_PAGE_SIZE, totalCount);
    }

    private static ImportedPlacePetInfo petInfo() {
        return ImportedPlacePetInfo.builder()
            .acmpyTypeCd("전구역 동반가능")
            .allowanceScope("FULL_AREA")
            .allowedPetSize("UNKNOWN")
            .build();
    }
}
