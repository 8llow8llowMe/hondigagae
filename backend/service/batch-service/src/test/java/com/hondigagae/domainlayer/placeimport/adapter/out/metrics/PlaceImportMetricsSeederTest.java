package com.hondigagae.domainlayer.placeimport.adapter.out.metrics;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceImportMetricsPort;
import com.hondigagae.domainlayer.placeimport.domain.enums.PlaceSourceType;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.batch.core.BatchStatus;
import org.springframework.batch.core.JobExecution;
import org.springframework.batch.core.JobInstance;
import org.springframework.batch.core.explore.JobExplorer;
import org.springframework.boot.DefaultApplicationArguments;

class PlaceImportMetricsSeederTest {

    private final JobExplorer jobExplorer = mock(JobExplorer.class);
    private final PlaceImportMetricsPort placeImportMetricsPort = mock(PlaceImportMetricsPort.class);
    private final PlaceImportMetricsSeeder seeder = new PlaceImportMetricsSeeder(jobExplorer, placeImportMetricsPort);

    @Test
    @DisplayName("마지막 COMPLETED 실행의 종료 시각을 소스별 last_success 로 씨딩한다")
    void seedsFromLastCompletedExecution() {
        when(jobExplorer.getJobInstances(anyString(), anyInt(), anyInt())).thenReturn(List.of());

        JobInstance instance = new JobInstance(1L, "placeImportJob");
        LocalDateTime completedAt = LocalDateTime.of(2026, 9, 1, 3, 0, 0);
        when(jobExplorer.getJobInstances(eq("placeImportJob"), anyInt(), anyInt())).thenReturn(List.of(instance));
        when(jobExplorer.getJobExecutions(instance)).thenReturn(List.of(
            execution(BatchStatus.FAILED, completedAt.plusDays(1)),
            execution(BatchStatus.COMPLETED, completedAt)
        ));

        seeder.run(new DefaultApplicationArguments());

        verify(placeImportMetricsPort).recordLastSuccess(
            PlaceSourceType.TOUR_API, completedAt.atZone(ZoneId.systemDefault()).toInstant());
        // 실행 이력이 없는 소스는 씨딩하지 않는다 — 없는 데이터를 "성공한 적 있음"으로 만들지 않는다
        verify(placeImportMetricsPort, never()).recordLastSuccess(eq(PlaceSourceType.CULTURE_PORTAL), any());
        verify(placeImportMetricsPort, never()).recordLastSuccess(eq(PlaceSourceType.MFDS), any());
    }

    @Test
    @DisplayName("COMPLETED 실행이 하나도 없으면 아무것도 씨딩하지 않는다")
    void skipsWhenNoCompletedExecution() {
        when(jobExplorer.getJobInstances(anyString(), anyInt(), anyInt())).thenReturn(List.of());

        JobInstance instance = new JobInstance(1L, "petRestaurantImportJob");
        when(jobExplorer.getJobInstances(eq("petRestaurantImportJob"), anyInt(), anyInt())).thenReturn(List.of(instance));
        when(jobExplorer.getJobExecutions(instance)).thenReturn(List.of(
            execution(BatchStatus.FAILED, LocalDateTime.of(2026, 9, 1, 3, 0, 0))
        ));

        seeder.run(new DefaultApplicationArguments());

        verify(placeImportMetricsPort, never()).recordLastSuccess(any(), any());
    }

    @Test
    @DisplayName("메타데이터 조회가 실패해도 기동을 막지 않는다 — 씨딩은 best-effort 다")
    void toleratesMetadataFailure() {
        when(jobExplorer.getJobInstances(anyString(), anyInt(), anyInt()))
            .thenThrow(new IllegalStateException("metadata unavailable"));

        seeder.run(new DefaultApplicationArguments());

        verify(placeImportMetricsPort, never()).recordLastSuccess(any(), any());
    }

    private JobExecution execution(BatchStatus status, LocalDateTime endTime) {
        JobExecution execution = new JobExecution(1L);
        execution.setStatus(status);
        execution.setEndTime(endTime);
        return execution;
    }
}
