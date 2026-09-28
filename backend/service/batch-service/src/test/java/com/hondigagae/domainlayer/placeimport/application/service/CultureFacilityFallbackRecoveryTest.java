package com.hondigagae.domainlayer.placeimport.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportErrorCode;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportException;
import com.hondigagae.domainlayer.placeimport.application.model.CultureFacilityImportOutcome;
import com.hondigagae.domainlayer.placeimport.application.port.in.CultureFacilityImportUseCase.CultureFacilityImportResult;
import com.hondigagae.domainlayer.placeimport.application.port.out.CultureFacilitySourcePort;
import com.hondigagae.domainlayer.placeimport.application.port.out.ImportSourceSnapshotPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceImportMetricsPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.CultureFacilityCsvFileQueryResult;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.CultureFacilitySourceQueryResult;
import com.hondigagae.domainlayer.placeimport.application.service.processor.CultureFacilityImportProcessor;
import com.hondigagae.domainlayer.placeimport.application.service.processor.CultureFacilitySourceProcessor;
import com.hondigagae.domainlayer.placeimport.application.service.processor.DelistProcessor;
import com.hondigagae.domainlayer.placeimport.application.service.processor.EmergencyFacilityImportProcessor;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceSourceType;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportSourceSnapshot;
import com.hondigagae.global.properties.CultureFacilityProperties;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * 포털 → 우회 → 포털로 돌아오는 여러 실행을 잇달아 돌려 본다 (#887).
 *
 * <p>올레의 {@code OlleCourseFallbackRecoveryTest} 와 같은 네 경우다. 판정 규칙은
 * {@code SourceFileSnapshotRule} 하나를 같이 쓰므로 두 잡이 같은 답을 내야 한다.
 */
@ExtendWith(MockitoExtension.class)
class CultureFacilityFallbackRecoveryTest {

    private static final String SIDO = "제주특별자치도";
    private static final String AREA_CODE = "39";
    private static final String FILE_ID = "FILE_000000003214426";
    private static final long CONTENT_LENGTH = 30_633_222L;

    @TempDir
    Path tempDir;

    @Mock
    private CultureFacilitySourcePort cultureFacilitySourcePort;

    @Mock
    private CultureFacilityImportProcessor cultureFacilityImportProcessor;

    @Mock
    private EmergencyFacilityImportProcessor emergencyFacilityImportProcessor;

    @Mock
    private DelistProcessor delistProcessor;

    @Mock
    private PlaceImportMetricsPort placeImportMetricsPort;

    private final InMemorySnapshotPort snapshotPort = new InMemorySnapshotPort();
    private final AtomicInteger downloads = new AtomicInteger();
    private CultureFacilityImportFacade facade;

    @BeforeEach
    void setUp() throws IOException {
        Path localFile = tempDir.resolve("pet_culture.csv");
        Files.writeString(localFile, "시설명\n");
        CultureFacilityProperties properties =
            new CultureFacilityProperties(localFile.toString(), true, null, null, tempDir.toString(), 0, 0L);
        CultureFacilitySourceProcessor sourceProcessor =
            new CultureFacilitySourceProcessor(cultureFacilitySourcePort, snapshotPort, properties);
        facade = new CultureFacilityImportFacade(sourceProcessor, cultureFacilityImportProcessor,
            emergencyFacilityImportProcessor, delistProcessor, snapshotPort, placeImportMetricsPort);
        given(cultureFacilityImportProcessor.importFacilities(any(), eq(SIDO)))
            .willReturn(new CultureFacilityImportOutcome(228, null));
    }

    @Test
    @DisplayName("(a) 우회 적재 뒤 포털이 살아나면 같은 파일이어도 적재한다")
    void importsSamePortalFileAfterFallback() {
        givenDownloadable();
        given(cultureFacilitySourcePort.resolveLatest())
            .willReturn(portal())
            .willThrow(portalDown())
            .willReturn(portal());

        assertImported(facade.importFacilities(SIDO, false), false);
        assertImported(facade.importFacilities(SIDO, false), true);
        assertThat(snapshotPort.latest()).hasValueSatisfying(row -> assertThat(row.isFallback()).isTrue());

        CultureFacilityImportResult recovered = facade.importFacilities(SIDO, false);

        assertImported(recovered, false);
        assertThat(snapshotPort.latest()).hasValueSatisfying(row -> {
            assertThat(row.fileId()).isEqualTo(FILE_ID);
            assertThat(row.isFallback()).isFalse();
        });
        verify(cultureFacilityImportProcessor, times(3)).importFacilities(any(), eq(SIDO));
    }

    @Test
    @DisplayName("(b) 포털 적재 뒤 포털이 같은 파일이면 건너뛴다")
    void skipsSamePortalFileAfterPortalImport() {
        givenDownloadable();
        given(cultureFacilitySourcePort.resolveLatest()).willReturn(portal());

        assertImported(facade.importFacilities(SIDO, false), false);
        CultureFacilityImportResult second = facade.importFacilities(SIDO, false);

        assertThat(second.skippedUnchanged()).isTrue();
        assertThat(downloads.get()).isEqualTo(1);
        verify(cultureFacilityImportProcessor, times(1)).importFacilities(any(), eq(SIDO));
    }

    @Test
    @DisplayName("(c) 우회 뒤 또 우회여도 적재한다")
    void importsFallbackAfterFallback() {
        given(cultureFacilitySourcePort.resolveLatest()).willThrow(portalDown());

        assertImported(facade.importFacilities(SIDO, false), true);
        assertImported(facade.importFacilities(SIDO, false), true);

        verify(cultureFacilityImportProcessor, times(2)).importFacilities(any(), eq(SIDO));
        assertThat(snapshotPort.rows).hasSize(2).allSatisfy(row -> assertThat(row.isFallback()).isTrue());
    }

    @Test
    @DisplayName("(d) 우회 뒤 포털 적재가 성공하면 그다음 같은 포털 파일은 다시 건너뛴다")
    void skipsAgainOncePortalReimportSucceeded() {
        givenDownloadable();
        given(cultureFacilitySourcePort.resolveLatest())
            .willThrow(portalDown())
            .willReturn(portal());

        assertImported(facade.importFacilities(SIDO, false), true);
        assertImported(facade.importFacilities(SIDO, false), false);
        CultureFacilityImportResult steady = facade.importFacilities(SIDO, false);

        assertThat(steady.skippedUnchanged()).isTrue();
        assertThat(downloads.get()).isEqualTo(1);
        verify(cultureFacilityImportProcessor, times(2)).importFacilities(any(), eq(SIDO));
    }

    private void assertImported(CultureFacilityImportResult result, boolean fallback) {
        assertThat(result.skippedUnchanged()).isFalse();
        assertThat(result.imported()).isEqualTo(228);
        assertThat(result.fallbackUsed()).isEqualTo(fallback);
    }

    private void givenDownloadable() {
        given(cultureFacilitySourcePort.download(any())).willAnswer(invocation -> {
            Path file = tempDir.resolve("download-" + downloads.incrementAndGet() + ".csv");
            Files.writeString(file, "시설명\n");
            return new CultureFacilityCsvFileQueryResult(file, "한국문화정보원_20250324.csv", CONTENT_LENGTH);
        });
    }

    private static CultureFacilitySourceQueryResult portal() {
        return new CultureFacilitySourceQueryResult(FILE_ID, "1",
            "https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=" + FILE_ID + "&fileDetailSn=1");
    }

    private static PlaceImportException portalDown() {
        return new PlaceImportException(PlaceImportErrorCode.CULTURE_SOURCE_PAGE_FAILED, "503");
    }

    /** append-only 테이블처럼 쌓고 (source, areaCode) 의 마지막 행을 최신으로 돌려준다. */
    private static final class InMemorySnapshotPort implements ImportSourceSnapshotPort {

        private final List<ImportSourceSnapshot> rows = new ArrayList<>();

        @Override
        public Optional<ImportSourceSnapshot> findLatest(PlaceSourceType source, String areaCode) {
            return rows.stream()
                .filter(row -> row.source() == source && row.areaCode().equals(areaCode))
                .reduce((first, second) -> second);
        }

        @Override
        public void record(ImportSourceSnapshot snapshot) {
            rows.add(snapshot);
        }

        Optional<ImportSourceSnapshot> latest() {
            return findLatest(PlaceSourceType.CULTURE_PORTAL, AREA_CODE);
        }
    }
}
