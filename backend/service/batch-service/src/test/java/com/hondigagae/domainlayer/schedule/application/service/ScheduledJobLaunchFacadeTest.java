package com.hondigagae.domainlayer.schedule.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hondigagae.domainlayer.schedule.application.command.ScheduledLaunchCommand;
import com.hondigagae.domainlayer.schedule.application.exception.ScheduleErrorCode;
import com.hondigagae.domainlayer.schedule.application.exception.ScheduleException;
import com.hondigagae.domainlayer.schedule.application.model.ScheduledLaunchResult;
import com.hondigagae.domainlayer.schedule.application.model.ScheduledLaunchResult.LaunchOutcome;
import com.hondigagae.domainlayer.schedule.application.port.out.BatchJobLaunchPort;
import com.hondigagae.domainlayer.schedule.application.port.out.ScheduleMetricsPort;
import com.hondigagae.domainlayer.schedule.application.service.processor.RunningJobGuardProcessor;
import com.hondigagae.global.properties.BatchScheduleProperties;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 발화 한 번이 갈 수 있는 길은 셋이다 — 띄운다 / 겹쳐서 넘긴다 / 띄우다 실패한다.
 * 셋 다 지표에 남아야 "스케줄러가 살아 있나"를 밖에서 볼 수 있다.
 */
class ScheduledJobLaunchFacadeTest {

    private static final String JOB_NAME = "placeDataPipelineJob";
    private static final List<String> BLOCKED_BY = List.of("placeDataPipelineJob", "placeImportJob");

    // 2026-09-14 03:00 KST (월요일 03:00 발화)
    private static final Instant FIRED_AT = Instant.parse("2026-09-13T18:00:00Z");
    private static final String EXPECTED_RUN_AT = "2026-09-14T03:00:00";

    private final BatchScheduleProperties batchScheduleProperties =
        new BatchScheduleProperties(true, "Asia/Seoul", null, null, Duration.ofHours(6));
    private final RunningJobGuardProcessor runningJobGuardProcessor = mock(RunningJobGuardProcessor.class);
    private final BatchJobLaunchPort batchJobLaunchPort = mock(BatchJobLaunchPort.class);
    private final ScheduleMetricsPort scheduleMetricsPort = mock(ScheduleMetricsPort.class);

    private final ScheduledJobLaunchFacade facade = new ScheduledJobLaunchFacade(
        batchScheduleProperties, runningJobGuardProcessor, batchJobLaunchPort, scheduleMetricsPort);

    private final ScheduledLaunchCommand command = new ScheduledLaunchCommand(JOB_NAME, BLOCKED_BY, FIRED_AT);

    @Test
    @DisplayName("겹치는 잡이 없으면 발화 시각을 Asia/Seoul 초 단위 runAt 으로 넘겨 잡을 띄운다")
    void launchesWithSeoulRunAt() {
        when(runningJobGuardProcessor.findBlocking(BLOCKED_BY, FIRED_AT, Duration.ofHours(6)))
            .thenReturn(Optional.empty());
        when(batchJobLaunchPort.launch(JOB_NAME, Map.of("runAt", EXPECTED_RUN_AT), Map.of("trigger", "quartz")))
            .thenReturn(4321L);

        ScheduledLaunchResult result = facade.launch(command);

        assertThat(result).isEqualTo(new ScheduledLaunchResult(JOB_NAME, EXPECTED_RUN_AT, LaunchOutcome.LAUNCHED, 4321L));
        verify(scheduleMetricsPort).recordFire(JOB_NAME, LaunchOutcome.LAUNCHED, FIRED_AT);
    }

    @Test
    @DisplayName("겹치는 잡이 있으면 띄우지 않고 SKIPPED_RUNNING 을 지표에 남긴다")
    void skipsWhenBlockingJobIsRunning() {
        when(runningJobGuardProcessor.findBlocking(BLOCKED_BY, FIRED_AT, Duration.ofHours(6)))
            .thenReturn(Optional.of("placeImportJob"));

        ScheduledLaunchResult result = facade.launch(command);

        assertThat(result).isEqualTo(new ScheduledLaunchResult(JOB_NAME, EXPECTED_RUN_AT, LaunchOutcome.SKIPPED_RUNNING, null));
        verify(batchJobLaunchPort, never()).launch(anyString(), any(), any());
        verify(scheduleMetricsPort).recordFire(JOB_NAME, LaunchOutcome.SKIPPED_RUNNING, FIRED_AT);
    }

    @Test
    @DisplayName("실행이 거부되면 FAILED 를 지표에 남기고 예외를 그대로 다시 던진다")
    void recordsFailureAndRethrows() {
        when(runningJobGuardProcessor.findBlocking(BLOCKED_BY, FIRED_AT, Duration.ofHours(6)))
            .thenReturn(Optional.empty());
        when(batchJobLaunchPort.launch(eq(JOB_NAME), any(), any()))
            .thenThrow(new ScheduleException(ScheduleErrorCode.LAUNCH_FAILED, JOB_NAME));

        assertThatThrownBy(() -> facade.launch(command))
            .isInstanceOf(ScheduleException.class)
            .extracting(exception -> ((ScheduleException) exception).getErrorCode())
            .isEqualTo(ScheduleErrorCode.LAUNCH_FAILED);
        verify(scheduleMetricsPort).recordFire(JOB_NAME, LaunchOutcome.FAILED, FIRED_AT);
    }
}
