package com.hondigagae.domainlayer.placeimport.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportErrorCode;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportException;
import com.hondigagae.domainlayer.placeimport.application.model.CultureFacilityImportOutcome;
import com.hondigagae.domainlayer.placeimport.application.model.CultureFacilitySourceDecision;
import com.hondigagae.domainlayer.placeimport.application.port.in.CultureFacilityImportUseCase.CultureFacilityImportResult;
import com.hondigagae.domainlayer.placeimport.application.port.out.ImportSourceSnapshotPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceImportMetricsPort;
import com.hondigagae.domainlayer.placeimport.application.service.processor.CultureFacilityImportProcessor;
import com.hondigagae.domainlayer.placeimport.application.service.processor.CultureFacilitySourceProcessor;
import com.hondigagae.domainlayer.placeimport.application.service.processor.DelistProcessor;
import com.hondigagae.domainlayer.placeimport.application.service.processor.EmergencyFacilityImportProcessor;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceImportResultType;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceSourceType;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportSourceSnapshot;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * 오케스트레이션 순서와 <b>지표를 남기는 자리</b>를 고정한다 (#379).
 *
 * <p>여기서 지키는 것 둘. 건너뛴 실행은 적재도 delist 도 부르지 않으면서 신선도는 갱신하고,
 * 우회 적재는 스냅샷을 남기지 않으면서 {@code result=fallback} 게이지로 드러난다 — 우회는
 * {@code last_success} 를 갱신해 버리므로 그 게이지가 유일한 드러남이다.
 */
@ExtendWith(MockitoExtension.class)
class CultureFacilityImportFacadeTest {

    private static final String SIDO = "제주특별자치도";
    private static final String AREA_CODE = "39";
    private static final String FILE_ID = "FILE_000000003214426";
    private static final long CONTENT_LENGTH = 30_633_222L;
    private static final Path CSV_FILE = Path.of("/tmp/pet_culture_123.csv");
    private static final Path LOCAL_FILE = Path.of("/app/data/pet_culture.csv");

    @Mock
    private CultureFacilitySourceProcessor cultureFacilitySourceProcessor;

    @Mock
    private CultureFacilityImportProcessor cultureFacilityImportProcessor;

    @Mock
    private EmergencyFacilityImportProcessor emergencyFacilityImportProcessor;

    @Mock
    private DelistProcessor delistProcessor;

    @Mock
    private ImportSourceSnapshotPort importSourceSnapshotPort;

    @Mock
    private PlaceImportMetricsPort placeImportMetricsPort;

    private CultureFacilityImportFacade facade() {
        return new CultureFacilityImportFacade(cultureFacilitySourceProcessor, cultureFacilityImportProcessor,
            emergencyFacilityImportProcessor, delistProcessor, importSourceSnapshotPort, placeImportMetricsPort);
    }

    private void givenDecision(CultureFacilitySourceDecision decision) {
        given(cultureFacilitySourceProcessor.resolve(AREA_CODE, false)).willReturn(decision);
    }

    @Test
    @DisplayName("직전과 같은 파일이면 적재·delist 를 부르지 않고 신선도만 갱신한다 (fallback 게이지는 0)")
    void skipUnchangedTouchesNothingButFreshness() {
        givenDecision(CultureFacilitySourceDecision.skipUnchanged(FILE_ID));

        CultureFacilityImportResult result = facade().importFacilities(SIDO, false);

        assertThat(result.skippedUnchanged()).isTrue();
        assertThat(result.imported()).isZero();
        assertThat(result.fileId()).isEqualTo(FILE_ID);
        assertThat(result.fallbackUsed()).isFalse();

        // 아무 행도 건드리지 않은 실행이라 delist 를 부르면 전부 사라진 것처럼 보인다.
        verify(cultureFacilityImportProcessor, never()).importFacilities(any(), any());
        verify(emergencyFacilityImportProcessor, never()).importFacilities(any(), any());
        verify(delistProcessor, never()).delistPlaces(any(), any(), any(), anyLong());
        verify(delistProcessor, never()).delistEmergencyFacilities(any(), anyLong());
        verify(importSourceSnapshotPort, never()).record(any());

        // 원천을 확인해 최신임을 안 실행이므로 성공이다 (14일 경보가 헛울리지 않게).
        verify(placeImportMetricsPort).recordLastSuccess(eq(PlaceSourceType.CULTURE_PORTAL), any(Instant.class));
        verify(placeImportMetricsPort).recordRows(PlaceSourceType.CULTURE_PORTAL, PlaceImportResultType.FALLBACK, 0);
    }

    @Test
    @DisplayName("새 파일이면 적재 → delist → 긴급시설 순으로 부르고 스냅샷과 지표를 남긴다")
    void importsInOrderAndRecordsSnapshot() {
        givenDecision(CultureFacilitySourceDecision.importFrom(CSV_FILE, FILE_ID, "새파일.csv", CONTENT_LENGTH));
        LocalDateTime sourceModifiedMax = LocalDateTime.of(2025, 3, 24, 0, 0);
        given(cultureFacilityImportProcessor.importFacilities(CSV_FILE, SIDO))
            .willReturn(new CultureFacilityImportOutcome(228, sourceModifiedMax));
        given(delistProcessor.delistPlaces(eq(PlaceSourceType.CULTURE_PORTAL), eq(AREA_CODE), any(), anyLong()))
            .willReturn(3);
        given(emergencyFacilityImportProcessor.importFacilities(CSV_FILE, SIDO)).willReturn(51);

        CultureFacilityImportResult result = facade().importFacilities(SIDO, false);

        assertThat(result.imported()).isEqualTo(228);
        assertThat(result.skippedUnchanged()).isFalse();
        assertThat(result.fallbackUsed()).isFalse();

        // delist 는 반드시 적재 뒤다 — 앞서 돌면 이번 실행이 갱신할 행까지 사라진 것으로 본다.
        InOrder order = inOrder(cultureFacilityImportProcessor, delistProcessor,
            emergencyFacilityImportProcessor, cultureFacilitySourceProcessor);
        order.verify(cultureFacilityImportProcessor).importFacilities(CSV_FILE, SIDO);
        order.verify(delistProcessor).delistPlaces(eq(PlaceSourceType.CULTURE_PORTAL), eq(AREA_CODE), any(), anyLong());
        order.verify(emergencyFacilityImportProcessor).importFacilities(CSV_FILE, SIDO);
        order.verify(delistProcessor).delistEmergencyFacilities(any(), anyLong());
        order.verify(cultureFacilitySourceProcessor).cleanUp(any());

        verify(placeImportMetricsPort).recordRows(PlaceSourceType.CULTURE_PORTAL, PlaceImportResultType.UPSERTED, 228);
        verify(placeImportMetricsPort).recordRows(PlaceSourceType.CULTURE_PORTAL, PlaceImportResultType.DELISTED, 3);
        verify(placeImportMetricsPort).recordRows(PlaceSourceType.CULTURE_PORTAL, PlaceImportResultType.FALLBACK, 0);
        verify(placeImportMetricsPort).recordLastSuccess(eq(PlaceSourceType.CULTURE_PORTAL), any(Instant.class));

        ArgumentCaptor<ImportSourceSnapshot> snapshot = ArgumentCaptor.forClass(ImportSourceSnapshot.class);
        verify(importSourceSnapshotPort).record(snapshot.capture());
        assertThat(snapshot.getValue().fileId()).isEqualTo(FILE_ID);
        assertThat(snapshot.getValue().contentLength()).isEqualTo(CONTENT_LENGTH);
        assertThat(snapshot.getValue().sourceModifiedMax()).isEqualTo(sourceModifiedMax);
        assertThat(snapshot.getValue().importedCount()).isEqualTo(228);
    }

    @Test
    @DisplayName("우회 적재는 스냅샷을 남기지 않고 fallback 게이지 1 로 드러난다 — last_success 는 갱신된다")
    void fallbackImportRecordsGaugeButNoSnapshot() {
        givenDecision(CultureFacilitySourceDecision.fallback(LOCAL_FILE));
        given(cultureFacilityImportProcessor.importFacilities(LOCAL_FILE, SIDO))
            .willReturn(new CultureFacilityImportOutcome(228, null));
        given(emergencyFacilityImportProcessor.importFacilities(LOCAL_FILE, SIDO)).willReturn(51);

        CultureFacilityImportResult result = facade().importFacilities(SIDO, false);

        assertThat(result.fallbackUsed()).isTrue();
        assertThat(result.fileId()).isNull();

        // 남기면 다음 실행이 포털을 보지 않고 건너뛰어, 포털이 되살아나도 낡은 파일에 머문다.
        verify(importSourceSnapshotPort, never()).record(any());
        // 데이터는 들어왔으니 신선도는 갱신된다 — 그래서 우회는 이 게이지로만 드러난다.
        verify(placeImportMetricsPort).recordLastSuccess(eq(PlaceSourceType.CULTURE_PORTAL), any(Instant.class));
        verify(placeImportMetricsPort).recordRows(PlaceSourceType.CULTURE_PORTAL, PlaceImportResultType.FALLBACK, 1);
    }

    @Test
    @DisplayName("적재 도중 터져도 임시 파일은 치운다 — 예외는 그대로 올린다")
    void cleansUpEvenWhenImportFails() {
        CultureFacilitySourceDecision decision =
            CultureFacilitySourceDecision.importFrom(CSV_FILE, FILE_ID, "새파일.csv", CONTENT_LENGTH);
        givenDecision(decision);
        willThrow(new PlaceImportException(PlaceImportErrorCode.CULTURE_CSV_READ_FAILED, "3행"))
            .given(cultureFacilityImportProcessor).importFacilities(CSV_FILE, SIDO);

        assertThatThrownBy(() -> facade().importFacilities(SIDO, false))
            .isInstanceOf(PlaceImportException.class)
            .extracting(exception -> ((PlaceImportException) exception).getErrorCode())
            .isEqualTo(PlaceImportErrorCode.CULTURE_CSV_READ_FAILED);

        // 30MB 임시 파일이 실패마다 쌓이면 디스크가 먼저 찬다.
        verify(cultureFacilitySourceProcessor).cleanUp(decision);
        verify(placeImportMetricsPort, never()).recordLastSuccess(any(), any());
        verify(importSourceSnapshotPort, never()).record(any());
    }

    @Test
    @DisplayName("매핑에 없는 시도는 원천을 보기 전에 REGION_NOT_SUPPORTED 로 막는다")
    void rejectsUnknownSidoBeforeResolvingSource() {
        assertThatThrownBy(() -> facade().importFacilities("경기도", false))
            .isInstanceOf(PlaceImportException.class)
            .extracting(exception -> ((PlaceImportException) exception).getErrorCode())
            .isEqualTo(PlaceImportErrorCode.REGION_NOT_SUPPORTED);

        verify(cultureFacilitySourceProcessor, never()).resolve(any(), anyBoolean());
    }
}
