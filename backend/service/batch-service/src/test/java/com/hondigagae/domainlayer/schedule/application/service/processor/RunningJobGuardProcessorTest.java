package com.hondigagae.domainlayer.schedule.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.hondigagae.domainlayer.schedule.application.port.out.BatchJobExecutionQueryPort;
import com.hondigagae.domainlayer.schedule.application.port.out.query.RunningJobExecutionQueryResult;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 이 가드가 틀리는 방향은 둘 다 나쁘다 — 너무 느슨하면 같은 행을 두 흐름이 쓰고,
 * 너무 빡빡하면 죽은 JVM 이 남긴 STARTED 행 하나에 스케줄이 영원히 막힌다.
 */
class RunningJobGuardProcessorTest {

    private static final Instant NOW = Instant.parse("2026-09-14T18:00:00Z");
    private static final Duration STALE_AFTER = Duration.ofHours(6);
    private static final List<String> JOB_NAMES = List.of("placeDataPipelineJob", "placeImportJob");

    private final BatchJobExecutionQueryPort batchJobExecutionQueryPort = mock(BatchJobExecutionQueryPort.class);
    private final RunningJobGuardProcessor processor = new RunningJobGuardProcessor(batchJobExecutionQueryPort);

    @Test
    @DisplayName("staleAfter 안에 시작한 STARTED 실행이 있으면 그 잡 이름으로 막는다")
    void blocksWhenRecentExecutionIsStillRunning() {
        when(batchJobExecutionQueryPort.findRunning(JOB_NAMES)).thenReturn(List.of(
            new RunningJobExecutionQueryResult("placeImportJob", 91L, NOW.minus(Duration.ofHours(2)))));

        assertThat(processor.findBlocking(JOB_NAMES, NOW, STALE_AFTER)).contains("placeImportJob");
    }

    @Test
    @DisplayName("staleAfter 를 넘긴 STARTED 만 있으면 방치된 실행으로 보고 통과시킨다")
    void ignoresAbandonedExecution() {
        when(batchJobExecutionQueryPort.findRunning(JOB_NAMES)).thenReturn(List.of(
            new RunningJobExecutionQueryResult("placeDataPipelineJob", 42L, NOW.minus(Duration.ofHours(30)))));

        assertThat(processor.findBlocking(JOB_NAMES, NOW, STALE_AFTER)).isEmpty();
    }

    @Test
    @DisplayName("실행 중인 잡이 없으면 통과시킨다")
    void passesWhenNothingIsRunning() {
        when(batchJobExecutionQueryPort.findRunning(JOB_NAMES)).thenReturn(List.of());

        assertThat(processor.findBlocking(JOB_NAMES, NOW, STALE_AFTER)).isEmpty();
    }

    @Test
    @DisplayName("방치된 실행과 최근 실행이 섞여 있으면 최근 실행 쪽으로 막는다")
    void blocksOnRecentEvenWhenAbandonedExecutionComesFirst() {
        when(batchJobExecutionQueryPort.findRunning(JOB_NAMES)).thenReturn(List.of(
            new RunningJobExecutionQueryResult("placeDataPipelineJob", 42L, NOW.minus(Duration.ofHours(30))),
            new RunningJobExecutionQueryResult("placeImportJob", 91L, NOW.minus(Duration.ofMinutes(10)))));

        assertThat(processor.findBlocking(JOB_NAMES, NOW, STALE_AFTER)).contains("placeImportJob");
    }
}
