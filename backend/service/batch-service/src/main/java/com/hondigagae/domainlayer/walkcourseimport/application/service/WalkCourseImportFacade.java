package com.hondigagae.domainlayer.walkcourseimport.application.service;

import com.hondigagae.domainlayer.walkcourseimport.application.model.OlleCourseSourceDecision;
import com.hondigagae.domainlayer.walkcourseimport.application.port.in.WalkCourseImportUseCase;
import com.hondigagae.domainlayer.walkcourseimport.application.port.out.OlleCourseSnapshotPort;
import com.hondigagae.domainlayer.walkcourseimport.application.port.out.WalkCourseImportMetricsPort;
import com.hondigagae.domainlayer.walkcourseimport.application.service.processor.OlleCourseImportProcessor;
import com.hondigagae.domainlayer.walkcourseimport.application.service.processor.OlleCourseSourceProcessor;
import com.hondigagae.domainlayer.walkcourseimport.domain.enums.WalkCourseImportResultType;
import com.hondigagae.domainlayer.walkcourseimport.domain.model.ImportedWalkCourse;
import com.hondigagae.domainlayer.walkcourseimport.domain.model.OlleCourseSnapshot;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 제주올레 코스 적재 오케스트레이터.
 *
 * <p>원천 결정 → CSV 적재 + TourAPI 좌표 결합을 잇달아 수행한다. 원천 결정이
 * "직전과 같은 파일"이면 나머지를 전부 건너뛴다.
 *
 * <p>{@code @Transactional} 을 붙이지 않는다. 파일 다운로드와 TourAPI 호출을 한 트랜잭션으로
 * 묶으면 커넥션을 오래 잡는다. 재실행이 멱등이라 중간에 실패하면 잡을 다시 돌리면 된다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WalkCourseImportFacade implements WalkCourseImportUseCase {

    private final OlleCourseSourceProcessor olleCourseSourceProcessor;
    private final OlleCourseImportProcessor olleCourseImportProcessor;
    private final OlleCourseSnapshotPort olleCourseSnapshotPort;
    private final WalkCourseImportMetricsPort walkCourseImportMetricsPort;

    @Override
    public OlleCourseImportResult importOlleCourses(boolean forceImport) {
        OlleCourseSourceDecision decision = olleCourseSourceProcessor.resolve(forceImport);
        recordFallbackFlag(decision);
        if (decision.kind() == OlleCourseSourceDecision.Kind.SKIP_UNCHANGED) {
            log.info("olle course import skipped unchanged fileId={}", decision.fileId());
            return new OlleCourseImportResult(0, true, decision.fileId(), false);
        }

        try {
            LocalDateTime runStartedAt = LocalDateTime.now();
            List<ImportedWalkCourse> imported = olleCourseImportProcessor.importCourses(decision.csvFile());
            walkCourseImportMetricsPort.recordRows(WalkCourseImportResultType.UPSERTED, imported.size());
            if (!imported.isEmpty() && !decision.fallback()) {
                recordSnapshot(decision, imported, runStartedAt);
            }
            return new OlleCourseImportResult(imported.size(), false, decision.fileId(), decision.fallback());
        } finally {
            olleCourseSourceProcessor.cleanUp(decision);
        }
    }

    /**
     * 이번 실행이 우회 원천을 썼는지를 1/0 게이지로 남긴다 (#876).
     *
     * <p><b>원천이 정해진 모든 실행에서 부른다</b> — 건너뛴 실행과 포털 적재는 0 이다. 게이지는 마지막
     * 실행 값만 담으므로 우회 다음에 정상 실행이 오면 0 으로 되돌아야 한다. 원천을 못 정해 잡이
     * 실패하면 부르지 않는다 — 그 실패는 잡 실패로 드러난다.
     *
     * <p>포털 페이지 구조가 바뀌어 매 실행 우회 CSV 로 돌던 동안 WARN 한 줄 말고는 아무것도
     * 그 상태를 드러내지 않았다 ({@code CultureFacilityImportFacade} 의 #379 와 같은 이유).
     */
    private void recordFallbackFlag(OlleCourseSourceDecision decision) {
        walkCourseImportMetricsPort.recordRows(WalkCourseImportResultType.FALLBACK, decision.fallback() ? 1 : 0);
    }

    /**
     * 다음 실행이 비교할 기준을 남긴다.
     *
     * <p><b>우회 적재는 남기지 않는다.</b> 우회 파일이 포털에 지금 올라와 있는 것과 같다는
     * 보장이 없다. 남기면 다음 실행이 포털을 보지 않고 건너뛰어, 포털이 되살아나도 낡은
     * 파일에 머문다.
     */
    private void recordSnapshot(
        OlleCourseSourceDecision decision, List<ImportedWalkCourse> imported, LocalDateTime runStartedAt
    ) {
        olleCourseSnapshotPort.record(new OlleCourseSnapshot(
            decision.fileId(), decision.fileName(), decision.contentLength(),
            sourceModifiedMax(imported), imported.size(), runStartedAt));
    }

    private static LocalDateTime sourceModifiedMax(List<ImportedWalkCourse> imported) {
        return imported.stream()
            .map(ImportedWalkCourse::baseDate)
            .map(WalkCourseImportFacade::parseBaseDate)
            .flatMap(Optional::stream)
            .max(LocalDateTime::compareTo)
            .orElse(null);
    }

    private static Optional<LocalDateTime> parseBaseDate(String raw) {
        if (raw == null || raw.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.of(LocalDate.parse(raw.trim()).atStartOfDay());
        } catch (DateTimeParseException exception) {
            return Optional.empty();
        }
    }
}
