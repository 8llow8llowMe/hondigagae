package com.hondigagae.domainlayer.walkcourseimport.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.hondigagae.domainlayer.walkcourseimport.application.exception.WalkCourseImportErrorCode;
import com.hondigagae.domainlayer.walkcourseimport.application.exception.WalkCourseImportException;
import com.hondigagae.domainlayer.walkcourseimport.application.model.OlleCourseSourceDecision;
import com.hondigagae.domainlayer.walkcourseimport.application.port.out.OlleCourseSnapshotPort;
import com.hondigagae.domainlayer.walkcourseimport.application.port.out.OlleCourseSourcePort;
import com.hondigagae.domainlayer.walkcourseimport.application.port.out.query.OlleCourseCsvFileQueryResult;
import com.hondigagae.domainlayer.walkcourseimport.application.port.out.query.OlleCourseSourceQueryResult;
import com.hondigagae.domainlayer.walkcourseimport.domain.model.OlleCourseSnapshot;
import com.hondigagae.global.properties.OlleCourseProperties;
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

@ExtendWith(MockitoExtension.class)
class OlleCourseSourceProcessorTest {

    private static final String FILE_ID = "FILE_000000001111111";
    private static final long CONTENT_LENGTH = 4_096L;

    @TempDir
    Path tempDir;

    @Mock
    private OlleCourseSourcePort olleCourseSourcePort;

    @Mock
    private OlleCourseSnapshotPort olleCourseSnapshotPort;

    private Path localFile;
    private Path downloadedFile;

    @BeforeEach
    void setUp() throws IOException {
        localFile = tempDir.resolve("olle_course.csv");
        downloadedFile = tempDir.resolve("olle_course_download.csv");
        Files.writeString(downloadedFile, "코스별,코스명\n");
    }

    private OlleCourseSourceProcessor processor(boolean downloadEnabled) {
        OlleCourseProperties properties =
            new OlleCourseProperties(localFile.toString(), downloadEnabled, null, null, tempDir.toString(), 0, 0L);
        return new OlleCourseSourceProcessor(olleCourseSourcePort, olleCourseSnapshotPort, properties);
    }

    private OlleCourseSourceQueryResult source(String fileId) {
        return new OlleCourseSourceQueryResult(fileId, "1",
            "https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=" + fileId + "&fileDetailSn=1");
    }

    private OlleCourseSnapshot snapshot(String fileId) {
        return new OlleCourseSnapshot(fileId, "직전.csv", CONTENT_LENGTH, null, 29, LocalDateTime.of(2026, 9, 1, 5, 0));
    }

    @Test
    @DisplayName("직전과 같은 파일이면 내려받지 않고 건너뛴다")
    void skipsWithoutDownloadWhenFileIdUnchanged() {
        given(olleCourseSourcePort.resolveLatest()).willReturn(source(FILE_ID));
        given(olleCourseSnapshotPort.findLatest()).willReturn(Optional.of(snapshot(FILE_ID)));

        OlleCourseSourceDecision decision = processor(true).resolve(false);

        assertThat(decision.kind()).isEqualTo(OlleCourseSourceDecision.Kind.SKIP_UNCHANGED);
        assertThat(decision.fileId()).isEqualTo(FILE_ID);
        verify(olleCourseSourcePort, never()).download(any());
    }

    @Test
    @DisplayName("파일 식별자가 바뀌면 내려받아 적재한다")
    void downloadsWhenFileIdChanged() {
        given(olleCourseSourcePort.resolveLatest()).willReturn(source("FILE_000000009999999"));
        given(olleCourseSnapshotPort.findLatest()).willReturn(Optional.of(snapshot(FILE_ID)));
        given(olleCourseSourcePort.download(any()))
            .willReturn(new OlleCourseCsvFileQueryResult(downloadedFile, "새파일.csv", CONTENT_LENGTH + 100));

        OlleCourseSourceDecision decision = processor(true).resolve(false);

        assertThat(decision.kind()).isEqualTo(OlleCourseSourceDecision.Kind.IMPORT);
        assertThat(decision.csvFile()).isEqualTo(downloadedFile);
        assertThat(decision.fileId()).isEqualTo("FILE_000000009999999");
        assertThat(decision.fallback()).isFalse();
        verify(olleCourseSourcePort).download(any());
    }

    @Test
    @DisplayName("스냅샷이 없으면(첫 실행) 내려받아 적재한다")
    void downloadsOnFirstRun() {
        given(olleCourseSourcePort.resolveLatest()).willReturn(source(FILE_ID));
        given(olleCourseSnapshotPort.findLatest()).willReturn(Optional.empty());
        given(olleCourseSourcePort.download(any()))
            .willReturn(new OlleCourseCsvFileQueryResult(downloadedFile, "첫파일.csv", CONTENT_LENGTH));

        assertThat(processor(true).resolve(false).kind()).isEqualTo(OlleCourseSourceDecision.Kind.IMPORT);
    }

    @Test
    @DisplayName("forceImport 면 같은 파일이라도 다시 적재한다")
    void forceImportIgnoresSnapshot() {
        given(olleCourseSourcePort.resolveLatest()).willReturn(source(FILE_ID));
        given(olleCourseSourcePort.download(any()))
            .willReturn(new OlleCourseCsvFileQueryResult(downloadedFile, "같은파일.csv", CONTENT_LENGTH));

        OlleCourseSourceDecision decision = processor(true).resolve(true);

        assertThat(decision.kind()).isEqualTo(OlleCourseSourceDecision.Kind.IMPORT);
        verify(olleCourseSourcePort).download(any());
    }

    @Test
    @DisplayName("스냅샷 조회가 깨지면 모른다로 접고 내려받아 적재한다")
    void downloadsWhenSnapshotLookupFails() {
        given(olleCourseSourcePort.resolveLatest()).willReturn(source(FILE_ID));
        given(olleCourseSnapshotPort.findLatest())
            .willThrow(new BadSqlGrammarException("findLatest", "select 1", new SQLException("table not found")));
        given(olleCourseSourcePort.download(any()))
            .willReturn(new OlleCourseCsvFileQueryResult(downloadedFile, "같은파일.csv", CONTENT_LENGTH));

        OlleCourseSourceDecision decision = processor(true).resolve(false);

        assertThat(decision.kind()).isEqualTo(OlleCourseSourceDecision.Kind.IMPORT);
        assertThat(decision.fallback()).isFalse();
        verify(olleCourseSourcePort).download(any());
    }

    @Test
    @DisplayName("포털이 막히면 로컬 우회 파일로 적재한다")
    void fallsBackToLocalFileWhenPortalFails() throws IOException {
        Files.writeString(localFile, "코스별,코스명\n");
        given(olleCourseSourcePort.resolveLatest())
            .willThrow(new WalkCourseImportException(WalkCourseImportErrorCode.SOURCE_PAGE_FAILED, "503"));

        OlleCourseSourceDecision decision = processor(true).resolve(false);

        assertThat(decision.kind()).isEqualTo(OlleCourseSourceDecision.Kind.IMPORT);
        assertThat(decision.csvFile()).isEqualTo(localFile);
        assertThat(decision.fallback()).isTrue();
        assertThat(decision.fileId()).isNull();
    }

    @Test
    @DisplayName("포털도 막히고 우회 파일도 없으면 원래 실패를 그대로 던진다")
    void rethrowsWhenNoLocalFallback() {
        WalkCourseImportException cause = new WalkCourseImportException(WalkCourseImportErrorCode.DOWNLOAD_INVALID, "50 bytes");
        given(olleCourseSourcePort.resolveLatest()).willThrow(cause);

        assertThatThrownBy(() -> processor(true).resolve(false)).isSameAs(cause);
    }

    @Test
    @DisplayName("다운로드를 끄면 포털을 보지 않고 로컬 파일만 읽는다")
    void usesLocalFileOnlyWhenDownloadDisabled() throws IOException {
        Files.writeString(localFile, "코스별,코스명\n");

        OlleCourseSourceDecision decision = processor(false).resolve(false);

        assertThat(decision.csvFile()).isEqualTo(localFile);
        assertThat(decision.fallback()).isTrue();
        verify(olleCourseSourcePort, never()).resolveLatest();
    }

    @Test
    @DisplayName("다운로드를 껐는데 로컬 파일도 없으면 CSV_NOT_FOUND")
    void failsWhenDownloadDisabledAndNoLocalFile() {
        assertThatThrownBy(() -> processor(false).resolve(false))
            .isInstanceOf(WalkCourseImportException.class)
            .extracting(exception -> ((WalkCourseImportException) exception).getErrorCode())
            .isEqualTo(WalkCourseImportErrorCode.CSV_NOT_FOUND);
    }

    @Test
    @DisplayName("임시 파일은 지우고 우회 파일은 남긴다")
    void cleanUpDeletesTempFileOnly() throws IOException {
        Files.writeString(localFile, "코스별,코스명\n");
        OlleCourseSourceProcessor processor = processor(true);

        processor.cleanUp(OlleCourseSourceDecision.importFrom(downloadedFile, FILE_ID, "새파일.csv", CONTENT_LENGTH));
        assertThat(Files.exists(downloadedFile)).isFalse();

        processor.cleanUp(OlleCourseSourceDecision.fallback(localFile));
        assertThat(Files.exists(localFile)).isTrue();
    }
}
