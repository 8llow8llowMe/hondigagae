package com.hondigagae.domainlayer.placeimport.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportErrorCode;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportException;
import com.hondigagae.domainlayer.placeimport.application.model.CultureFacilitySourceDecision;
import com.hondigagae.domainlayer.placeimport.application.port.out.CultureFacilitySourcePort;
import com.hondigagae.domainlayer.placeimport.application.port.out.ImportSourceSnapshotPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.CultureFacilityCsvFileQueryResult;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.CultureFacilitySourceQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceSourceType;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportSourceSnapshot;
import com.hondigagae.global.properties.CultureFacilityProperties;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.BadSqlGrammarException;

/**
 * 무엇을 읽을지 정하는 규칙.
 *
 * <p>여기서 고정하는 것이 이 이슈의 값어치다 — <b>안 바뀐 파일은 받지도 않고</b>,
 * <b>포털이 막히면 잡을 죽이는 대신 예전 파일로 물러난다</b>.
 */
@ExtendWith(MockitoExtension.class)
class CultureFacilitySourceProcessorTest {

    private static final String AREA_CODE = "39";
    private static final String FILE_ID = "FILE_000000003214426";
    private static final long CONTENT_LENGTH = 30_633_222L;

    @TempDir
    Path tempDir;

    @Mock
    private CultureFacilitySourcePort cultureFacilitySourcePort;

    @Mock
    private ImportSourceSnapshotPort importSourceSnapshotPort;

    private Path localFile;
    private Path downloadedFile;

    @BeforeEach
    void setUp() throws IOException {
        localFile = tempDir.resolve("pet_culture.csv");
        downloadedFile = tempDir.resolve("pet_culture_download.csv");
        Files.writeString(downloadedFile, "시설명\n");
    }

    private CultureFacilitySourceProcessor processor(boolean downloadEnabled) {
        CultureFacilityProperties properties =
            new CultureFacilityProperties(localFile.toString(), downloadEnabled, null, null, tempDir.toString(), 0, 0L);
        return new CultureFacilitySourceProcessor(cultureFacilitySourcePort, importSourceSnapshotPort, properties);
    }

    private CultureFacilitySourceQueryResult source(String fileId) {
        return new CultureFacilitySourceQueryResult(fileId, "1",
            "https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=" + fileId + "&fileDetailSn=1");
    }

    private ImportSourceSnapshot snapshot(String fileId) {
        return new ImportSourceSnapshot(PlaceSourceType.CULTURE_PORTAL, AREA_CODE, fileId, "직전.csv",
            CONTENT_LENGTH, null, 228, LocalDateTime.of(2026, 9, 1, 3, 0));
    }

    @Test
    @DisplayName("직전과 같은 파일이면 내려받지 않고 건너뛴다")
    void skipsWithoutDownloadWhenFileIdUnchanged() {
        given(cultureFacilitySourcePort.resolveLatest()).willReturn(source(FILE_ID));
        given(importSourceSnapshotPort.findLatest(PlaceSourceType.CULTURE_PORTAL, AREA_CODE))
            .willReturn(Optional.of(snapshot(FILE_ID)));

        CultureFacilitySourceDecision decision = processor(true).resolve(AREA_CODE, false);

        assertThat(decision.kind()).isEqualTo(CultureFacilitySourceDecision.Kind.SKIP_UNCHANGED);
        assertThat(decision.fileId()).isEqualTo(FILE_ID);
        // 30MB 를 받지 않는 것이 이 분기의 전부다.
        verify(cultureFacilitySourcePort, never()).download(any());
    }

    @Test
    @DisplayName("파일 식별자가 바뀌면 내려받아 적재한다")
    void downloadsWhenFileIdChanged() {
        given(cultureFacilitySourcePort.resolveLatest()).willReturn(source("FILE_000000009999999"));
        given(importSourceSnapshotPort.findLatest(PlaceSourceType.CULTURE_PORTAL, AREA_CODE))
            .willReturn(Optional.of(snapshot(FILE_ID)));
        given(cultureFacilitySourcePort.download(any()))
            .willReturn(new CultureFacilityCsvFileQueryResult(downloadedFile, "새파일.csv", CONTENT_LENGTH + 100));

        CultureFacilitySourceDecision decision = processor(true).resolve(AREA_CODE, false);

        assertThat(decision.kind()).isEqualTo(CultureFacilitySourceDecision.Kind.IMPORT);
        assertThat(decision.csvFile()).isEqualTo(downloadedFile);
        assertThat(decision.fileId()).isEqualTo("FILE_000000009999999");
        assertThat(decision.fallback()).isFalse();
        verify(cultureFacilitySourcePort).download(any());
    }

    @Test
    @DisplayName("스냅샷이 아예 없으면(첫 실행) 내려받아 적재한다")
    void downloadsOnFirstRun() {
        given(cultureFacilitySourcePort.resolveLatest()).willReturn(source(FILE_ID));
        given(importSourceSnapshotPort.findLatest(PlaceSourceType.CULTURE_PORTAL, AREA_CODE)).willReturn(Optional.empty());
        given(cultureFacilitySourcePort.download(any()))
            .willReturn(new CultureFacilityCsvFileQueryResult(downloadedFile, "첫파일.csv", CONTENT_LENGTH));

        assertThat(processor(true).resolve(AREA_CODE, false).kind()).isEqualTo(CultureFacilitySourceDecision.Kind.IMPORT);
    }

    @Test
    @DisplayName("forceImport 면 같은 파일이라도 다시 적재한다")
    void forceImportIgnoresSnapshot() {
        given(cultureFacilitySourcePort.resolveLatest()).willReturn(source(FILE_ID));
        given(cultureFacilitySourcePort.download(any()))
            .willReturn(new CultureFacilityCsvFileQueryResult(downloadedFile, "같은파일.csv", CONTENT_LENGTH));

        CultureFacilitySourceDecision decision = processor(true).resolve(AREA_CODE, true);

        assertThat(decision.kind()).isEqualTo(CultureFacilitySourceDecision.Kind.IMPORT);
        verify(cultureFacilitySourcePort).download(any());
    }

    @Test
    @DisplayName("스냅샷 조회가 깨지면 '모른다'로 접고 내려받아 적재한다 — 최적화 때문에 적재를 멈추지 않는다")
    void downloadsWhenSnapshotLookupFails() {
        // prod 에 테이블이 아직 없거나 DB 가 잠깐 흔들린 상황. 여기서 죽으면 고칠 수 있었던 낡음이
        // 빈 데이터가 된다 — 스냅샷은 건너뛰기 최적화지 적재의 전제가 아니다.
        given(cultureFacilitySourcePort.resolveLatest()).willReturn(source(FILE_ID));
        given(importSourceSnapshotPort.findLatest(PlaceSourceType.CULTURE_PORTAL, AREA_CODE))
            .willThrow(new BadSqlGrammarException("findLatest", "select 1", new SQLException("table not found")));
        given(cultureFacilitySourcePort.download(any()))
            .willReturn(new CultureFacilityCsvFileQueryResult(downloadedFile, "같은파일.csv", CONTENT_LENGTH));

        CultureFacilitySourceDecision decision = processor(true).resolve(AREA_CODE, false);

        assertThat(decision.kind()).isEqualTo(CultureFacilitySourceDecision.Kind.IMPORT);
        assertThat(decision.fallback()).isFalse();
        verify(cultureFacilitySourcePort).download(any());
    }

    @Test
    @DisplayName("포털이 막히면 로컬 우회 파일로 적재한다 — 잡을 죽이지 않는다")
    void fallsBackToLocalFileWhenPortalFails() throws IOException {
        Files.writeString(localFile, "시설명\n");
        given(cultureFacilitySourcePort.resolveLatest())
            .willThrow(new PlaceImportException(PlaceImportErrorCode.CULTURE_SOURCE_PAGE_FAILED, "503"));

        CultureFacilitySourceDecision decision = processor(true).resolve(AREA_CODE, false);

        assertThat(decision.kind()).isEqualTo(CultureFacilitySourceDecision.Kind.IMPORT);
        assertThat(decision.csvFile()).isEqualTo(localFile);
        assertThat(decision.fallback()).isTrue();
        // 우회 적재는 포털에 무엇이 올라와 있는지 모르므로 스냅샷 근거가 되지 않는다.
        assertThat(decision.fileId()).isNull();
    }

    @Test
    @DisplayName("포털도 막히고 우회 파일도 없으면 원래 실패를 그대로 던진다")
    void rethrowsWhenNoLocalFallback() {
        PlaceImportException cause = new PlaceImportException(PlaceImportErrorCode.CULTURE_DOWNLOAD_INVALID, "512 bytes");
        given(cultureFacilitySourcePort.resolveLatest()).willThrow(cause);

        assertThatThrownBy(() -> processor(true).resolve(AREA_CODE, false)).isSameAs(cause);
    }

    @Test
    @DisplayName("다운로드를 끄면 포털을 보지 않고 로컬 파일만 읽는다")
    void usesLocalFileOnlyWhenDownloadDisabled() throws IOException {
        Files.writeString(localFile, "시설명\n");

        CultureFacilitySourceDecision decision = processor(false).resolve(AREA_CODE, false);

        assertThat(decision.csvFile()).isEqualTo(localFile);
        assertThat(decision.fallback()).isTrue();
        verify(cultureFacilitySourcePort, never()).resolveLatest();
    }

    @Test
    @DisplayName("다운로드를 껐는데 로컬 파일도 없으면 CULTURE_CSV_NOT_FOUND")
    void failsWhenDownloadDisabledAndNoLocalFile() {
        assertThatThrownBy(() -> processor(false).resolve(AREA_CODE, false))
            .isInstanceOf(PlaceImportException.class)
            .extracting(exception -> ((PlaceImportException) exception).getErrorCode())
            .isEqualTo(PlaceImportErrorCode.CULTURE_CSV_NOT_FOUND);
    }

    @Test
    @DisplayName("임시 파일은 지우고 우회 파일은 남긴다")
    void cleanUpDeletesTempFileOnly() throws IOException {
        Files.writeString(localFile, "시설명\n");
        CultureFacilitySourceProcessor processor = processor(true);

        processor.cleanUp(CultureFacilitySourceDecision.importFrom(downloadedFile, FILE_ID, "새파일.csv", CONTENT_LENGTH));
        assertThat(Files.exists(downloadedFile)).isFalse();

        // 우회 파일은 사람이 배포 호스트에 넣어 둔 마지막 보루다. 지우면 다음 실행이 갈 곳이 없다.
        processor.cleanUp(CultureFacilitySourceDecision.fallback(localFile));
        assertThat(Files.exists(localFile)).isTrue();
    }
}
