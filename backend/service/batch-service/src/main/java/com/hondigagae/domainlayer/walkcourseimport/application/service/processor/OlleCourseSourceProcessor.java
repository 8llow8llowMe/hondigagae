package com.hondigagae.domainlayer.walkcourseimport.application.service.processor;

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
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Component;

/**
 * 이번 실행에서 무엇을 읽을지 정한다.
 *
 * <p>포털에서 직접 받는 것이 기본이고, 직전 실행과 같은 파일이면 내려받기도 적재도
 * 건너뛴다. 올레 CSV 는 몇 달에 한 번 바뀌는데 매주 같은 파일을 다시 받아 TourAPI 를
 * 한 번 더 부를 이유가 없다.
 *
 * <p>건너뛰기 판정은 두 단계다. 먼저 상세 페이지에서 {@code atchFileId} 만 확인해 같으면
 * 받기 전에 끝낸다. 받은 뒤에는 바이트 수까지 맞춰 한 번 더 본다.
 *
 * <p>실패하면 로컬 우회 파일로 물러난다. 낡은 데이터가 빈 데이터보다 낫다
 * ({@code data-refresh-guide.md} 5절). 우회 파일마저 없으면 그때 실패한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OlleCourseSourceProcessor {

    private final OlleCourseSourcePort olleCourseSourcePort;
    private final OlleCourseSnapshotPort olleCourseSnapshotPort;
    private final OlleCourseProperties properties;

    public OlleCourseSourceDecision resolve(boolean forceImport) {
        if (!properties.downloadEnabled()) {
            log.info("olle course source download disabled. using local file path={}", properties.filePath());
            return localFallbackOrThrow(null);
        }

        try {
            OlleCourseSourceQueryResult source = olleCourseSourcePort.resolveLatest();
            Optional<OlleCourseSnapshot> latest = findLatestQuietly();

            if (!forceImport && latest.filter(snapshot -> snapshot.sameFileAs(source.fileId(), null)).isPresent()) {
                return OlleCourseSourceDecision.skipUnchanged(source.fileId());
            }

            OlleCourseCsvFileQueryResult file = olleCourseSourcePort.download(source);

            if (!forceImport && latest.filter(snapshot -> snapshot.sameFileAs(source.fileId(), file.contentLength())).isPresent()) {
                deleteQuietly(file.path());
                return OlleCourseSourceDecision.skipUnchanged(source.fileId());
            }

            return OlleCourseSourceDecision.importFrom(file.path(), source.fileId(), file.fileName(), file.contentLength());
        } catch (WalkCourseImportException exception) {
            return localFallbackOrThrow(exception);
        }
    }

    public void cleanUp(OlleCourseSourceDecision decision) {
        if (decision.kind() != OlleCourseSourceDecision.Kind.IMPORT || decision.fallback()) {
            return;
        }
        deleteQuietly(decision.csvFile());
    }

    private Optional<OlleCourseSnapshot> findLatestQuietly() {
        try {
            return olleCourseSnapshotPort.findLatest();
        } catch (DataAccessException exception) {
            log.warn("olle course snapshot unavailable — 다운로드로 진행 reason={}", exception.getMessage());
            return Optional.empty();
        }
    }

    private OlleCourseSourceDecision localFallbackOrThrow(WalkCourseImportException cause) {
        Path local = Path.of(properties.filePath());
        if (Files.exists(local)) {
            if (cause != null) {
                log.warn("olle course source fallback=local reason={} path={}", cause.getMessage(), local);
            }
            return OlleCourseSourceDecision.fallback(local);
        }
        if (cause != null) {
            throw cause;
        }
        throw new WalkCourseImportException(WalkCourseImportErrorCode.CSV_NOT_FOUND, local.toString());
    }

    private void deleteQuietly(Path path) {
        if (path == null) {
            return;
        }
        try {
            Files.deleteIfExists(path);
        } catch (IOException exception) {
            log.warn("olle course temp file delete failed path={} reason={}", path, exception.getMessage());
        }
    }
}
