package com.hondigagae.domainlayer.walkcourseimport.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.hondigagae.domainlayer.walkcourseimport.application.exception.WalkCourseImportErrorCode;
import com.hondigagae.domainlayer.walkcourseimport.application.exception.WalkCourseImportException;
import com.hondigagae.domainlayer.walkcourseimport.application.port.in.WalkCourseImportUseCase.OlleCourseImportResult;
import com.hondigagae.domainlayer.walkcourseimport.application.port.out.OlleCourseSnapshotPort;
import com.hondigagae.domainlayer.walkcourseimport.application.port.out.OlleCourseSourcePort;
import com.hondigagae.domainlayer.walkcourseimport.application.port.out.WalkCourseImportMetricsPort;
import com.hondigagae.domainlayer.walkcourseimport.application.port.out.query.OlleCourseCsvFileQueryResult;
import com.hondigagae.domainlayer.walkcourseimport.application.port.out.query.OlleCourseSourceQueryResult;
import com.hondigagae.domainlayer.walkcourseimport.application.service.processor.OlleCourseImportProcessor;
import com.hondigagae.domainlayer.walkcourseimport.application.service.processor.OlleCourseSourceProcessor;
import com.hondigagae.domainlayer.walkcourseimport.domain.model.ImportedWalkCourse;
import com.hondigagae.domainlayer.walkcourseimport.domain.model.OlleCourseSnapshot;
import com.hondigagae.global.properties.OlleCourseProperties;
import java.io.IOException;
import java.math.BigDecimal;
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
 * <p>원천 결정(프로세서)과 스냅샷 기록(파사드)이 서로 다른 클래스에 있어, 둘을 따로 시험하면
 * "우회 뒤 첫 포털 실행이 같은 파일로 보고 건너뛴다" 는 결함이 어느 한쪽 테스트에도 잡히지 않는다.
 * 그래서 실제 프로세서·파사드를 잇고 스냅샷 저장소만 메모리로 바꿔 실행 순서를 그대로 재현한다.
 */
@ExtendWith(MockitoExtension.class)
class OlleCourseFallbackRecoveryTest {

    private static final String FILE_ID = "FILE_000000007665534";
    private static final long CONTENT_LENGTH = 4_096L;

    @TempDir
    Path tempDir;

    @Mock
    private OlleCourseSourcePort olleCourseSourcePort;

    @Mock
    private OlleCourseImportProcessor olleCourseImportProcessor;

    @Mock
    private WalkCourseImportMetricsPort walkCourseImportMetricsPort;

    private final InMemorySnapshotPort snapshotPort = new InMemorySnapshotPort();
    private final AtomicInteger downloads = new AtomicInteger();
    private WalkCourseImportFacade facade;

    @BeforeEach
    void setUp() throws IOException {
        Path localFile = tempDir.resolve("olle_course.csv");
        Files.writeString(localFile, "코스별,코스명\n");
        OlleCourseProperties properties =
            new OlleCourseProperties(localFile.toString(), true, null, null, tempDir.toString(), 0, 0L);
        OlleCourseSourceProcessor sourceProcessor =
            new OlleCourseSourceProcessor(olleCourseSourcePort, snapshotPort, properties);
        facade = new WalkCourseImportFacade(sourceProcessor, olleCourseImportProcessor, snapshotPort, walkCourseImportMetricsPort);
        given(olleCourseImportProcessor.importCourses(any())).willReturn(List.of(course()));
    }

    @Test
    @DisplayName("(a) 우회 적재 뒤 포털이 살아나면 같은 파일이어도 적재한다")
    void importsSamePortalFileAfterFallback() {
        givenDownloadable();
        given(olleCourseSourcePort.resolveLatest())
            .willReturn(portal())
            .willThrow(portalDown())
            .willReturn(portal());

        assertImported(facade.importOlleCourses(false), false);
        OlleCourseImportResult fallback = facade.importOlleCourses(false);
        assertImported(fallback, true);
        assertThat(snapshotPort.latest()).hasValueSatisfying(row -> assertThat(row.isFallback()).isTrue());

        OlleCourseImportResult recovered = facade.importOlleCourses(false);

        assertImported(recovered, false);
        assertThat(snapshotPort.latest()).hasValueSatisfying(row -> {
            assertThat(row.fileId()).isEqualTo(FILE_ID);
            assertThat(row.isFallback()).isFalse();
        });
        verify(olleCourseImportProcessor, times(3)).importCourses(any());
    }

    @Test
    @DisplayName("(b) 포털 적재 뒤 포털이 같은 파일이면 건너뛴다")
    void skipsSamePortalFileAfterPortalImport() {
        givenDownloadable();
        given(olleCourseSourcePort.resolveLatest()).willReturn(portal());

        assertImported(facade.importOlleCourses(false), false);
        OlleCourseImportResult second = facade.importOlleCourses(false);

        assertThat(second.skippedUnchanged()).isTrue();
        assertThat(downloads.get()).isEqualTo(1);
        verify(olleCourseImportProcessor, times(1)).importCourses(any());
    }

    @Test
    @DisplayName("(c) 우회 뒤 또 우회여도 적재한다")
    void importsFallbackAfterFallback() {
        given(olleCourseSourcePort.resolveLatest()).willThrow(portalDown());

        assertImported(facade.importOlleCourses(false), true);
        assertImported(facade.importOlleCourses(false), true);

        verify(olleCourseImportProcessor, times(2)).importCourses(any());
        assertThat(snapshotPort.rows).hasSize(2).allSatisfy(row -> assertThat(row.isFallback()).isTrue());
    }

    @Test
    @DisplayName("(d) 우회 뒤 포털 적재가 성공하면 그다음 같은 포털 파일은 다시 건너뛴다")
    void skipsAgainOncePortalReimportSucceeded() {
        givenDownloadable();
        given(olleCourseSourcePort.resolveLatest())
            .willThrow(portalDown())
            .willReturn(portal());

        assertImported(facade.importOlleCourses(false), true);
        assertImported(facade.importOlleCourses(false), false);
        OlleCourseImportResult steady = facade.importOlleCourses(false);

        assertThat(steady.skippedUnchanged()).isTrue();
        assertThat(downloads.get()).isEqualTo(1);
        verify(olleCourseImportProcessor, times(2)).importCourses(any());
    }

    private void assertImported(OlleCourseImportResult result, boolean fallback) {
        assertThat(result.skippedUnchanged()).isFalse();
        assertThat(result.imported()).isEqualTo(1);
        assertThat(result.fallbackUsed()).isEqualTo(fallback);
    }

    private void givenDownloadable() {
        given(olleCourseSourcePort.download(any())).willAnswer(invocation -> {
            Path file = tempDir.resolve("download-" + downloads.incrementAndGet() + ".csv");
            Files.writeString(file, "코스별,코스명\n");
            return new OlleCourseCsvFileQueryResult(file, "제주올레_코스현황.csv", CONTENT_LENGTH);
        });
    }

    private static OlleCourseSourceQueryResult portal() {
        return new OlleCourseSourceQueryResult(FILE_ID, "1",
            "https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=" + FILE_ID + "&fileDetailSn=1");
    }

    private static WalkCourseImportException portalDown() {
        return new WalkCourseImportException(WalkCourseImportErrorCode.SOURCE_PAGE_FAILED, "503");
    }

    private static ImportedWalkCourse course() {
        return ImportedWalkCourse.builder()
            .id(1L).courseKey("1").courseNo("1").courseOrder(10).name("코스1")
            .distanceKm(new BigDecimal("15.1")).durationText("4~5시간").durationMaxMinutes(300)
            .startEndPoint("시점-종점").baseDate("2025-04-28")
            .build();
    }

    /** append-only 테이블처럼 쌓고 마지막 행을 최신으로 돌려준다. */
    private static final class InMemorySnapshotPort implements OlleCourseSnapshotPort {

        private final List<OlleCourseSnapshot> rows = new ArrayList<>();

        @Override
        public Optional<OlleCourseSnapshot> findLatest() {
            return latest();
        }

        @Override
        public void record(OlleCourseSnapshot snapshot) {
            rows.add(snapshot);
        }

        Optional<OlleCourseSnapshot> latest() {
            return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(rows.size() - 1));
        }
    }
}
