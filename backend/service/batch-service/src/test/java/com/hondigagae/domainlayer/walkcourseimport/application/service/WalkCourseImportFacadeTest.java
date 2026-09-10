package com.hondigagae.domainlayer.walkcourseimport.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.hondigagae.domainlayer.walkcourseimport.application.model.OlleCourseSourceDecision;
import com.hondigagae.domainlayer.walkcourseimport.application.port.in.WalkCourseImportUseCase.OlleCourseImportResult;
import com.hondigagae.domainlayer.walkcourseimport.application.port.out.OlleCourseSnapshotPort;
import com.hondigagae.domainlayer.walkcourseimport.application.service.processor.OlleCourseImportProcessor;
import com.hondigagae.domainlayer.walkcourseimport.application.service.processor.OlleCourseSourceProcessor;
import com.hondigagae.domainlayer.walkcourseimport.domain.model.ImportedWalkCourse;
import com.hondigagae.domainlayer.walkcourseimport.domain.model.OlleCourseSnapshot;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class WalkCourseImportFacadeTest {

    @Mock
    private OlleCourseSourceProcessor olleCourseSourceProcessor;

    @Mock
    private OlleCourseImportProcessor olleCourseImportProcessor;

    @Mock
    private OlleCourseSnapshotPort olleCourseSnapshotPort;

    @InjectMocks
    private WalkCourseImportFacade facade;

    @Test
    @DisplayName("직전과 같은 파일이면 적재와 스냅샷을 건너뛴다")
    void skipsImportWhenUnchanged() {
        given(olleCourseSourceProcessor.resolve(false))
            .willReturn(OlleCourseSourceDecision.skipUnchanged("FILE_1"));

        OlleCourseImportResult result = facade.importOlleCourses(false);

        assertThat(result.skippedUnchanged()).isTrue();
        assertThat(result.imported()).isZero();
        verify(olleCourseImportProcessor, never()).importCourses(any());
        verify(olleCourseSnapshotPort, never()).record(any());
    }

    @Test
    @DisplayName("포털에서 받은 파일을 적재하면 스냅샷을 남긴다")
    void recordsSnapshotAfterPortalImport() {
        Path csv = Path.of("downloaded.csv");
        given(olleCourseSourceProcessor.resolve(false))
            .willReturn(OlleCourseSourceDecision.importFrom(csv, "FILE_2", "olle.csv", 4096L));
        given(olleCourseImportProcessor.importCourses(csv)).willReturn(List.of(course("1", "2025-04-28")));

        OlleCourseImportResult result = facade.importOlleCourses(false);

        assertThat(result.imported()).isEqualTo(1);
        assertThat(result.fallbackUsed()).isFalse();
        ArgumentCaptor<OlleCourseSnapshot> captor = ArgumentCaptor.forClass(OlleCourseSnapshot.class);
        verify(olleCourseSnapshotPort).record(captor.capture());
        assertThat(captor.getValue().fileId()).isEqualTo("FILE_2");
        assertThat(captor.getValue().contentLength()).isEqualTo(4096L);
        assertThat(captor.getValue().importedCount()).isEqualTo(1);
        assertThat(captor.getValue().sourceModifiedMax()).isEqualTo(java.time.LocalDate.of(2025, 4, 28).atStartOfDay());
        verify(olleCourseSourceProcessor).cleanUp(any());
    }

    @Test
    @DisplayName("우회 적재는 스냅샷을 남기지 않는다")
    void fallbackDoesNotRecordSnapshot() {
        Path local = Path.of("data/olle_course.csv");
        given(olleCourseSourceProcessor.resolve(false)).willReturn(OlleCourseSourceDecision.fallback(local));
        given(olleCourseImportProcessor.importCourses(local)).willReturn(List.of(course("1", "2025-04-28")));

        OlleCourseImportResult result = facade.importOlleCourses(false);

        assertThat(result.fallbackUsed()).isTrue();
        verify(olleCourseSnapshotPort, never()).record(any());
        verify(olleCourseSourceProcessor).cleanUp(any());
    }

    private static ImportedWalkCourse course(String courseNo, String baseDate) {
        return ImportedWalkCourse.builder()
            .id(1L)
            .courseKey(courseNo)
            .courseNo(courseNo)
            .courseOrder(10)
            .name("코스" + courseNo)
            .distanceKm(new BigDecimal("15.1"))
            .durationText("4~5시간")
            .durationMaxMinutes(300)
            .startEndPoint("시점-종점")
            .baseDate(baseDate)
            .build();
    }
}
