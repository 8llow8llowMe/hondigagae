package com.hondigagae.domainlayer.schedule.adapter.out.batch;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hondigagae.domainlayer.schedule.application.exception.ScheduleErrorCode;
import com.hondigagae.domainlayer.schedule.application.exception.ScheduleException;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.batch.core.Job;
import org.springframework.batch.core.JobExecution;
import org.springframework.batch.core.JobParameters;
import org.springframework.batch.core.launch.JobLauncher;
import org.springframework.batch.core.repository.JobInstanceAlreadyCompleteException;

/**
 * 스케줄이 부르는 이름은 빈 이름이 아니라 {@code Job.getName()} 이고, {@code runAt} 만 JobInstance 를
 * 가른다. 이 둘이 어긋나면 "잡이 안 돈다" 또는 "매번 이미 완료" 로 조용히 끝난다.
 */
class SpringBatchJobLaunchAdapterTest {

    private static final String JOB_NAME = "placeDataPipelineJob";
    private static final String RUN_AT = "2026-09-14T03:00:00";

    private final Job placeDataPipelineJob = mock(Job.class);
    private final JobLauncher jobLauncher = mock(JobLauncher.class);

    private SpringBatchJobLaunchAdapter adapter() {
        when(placeDataPipelineJob.getName()).thenReturn(JOB_NAME);
        return new SpringBatchJobLaunchAdapter(List.of(placeDataPipelineJob), jobLauncher);
    }

    @Test
    @DisplayName("잡 이름으로 Job 을 찾아 띄우고 JobExecution id 를 돌려준다")
    void launchesJobByName() throws Exception {
        SpringBatchJobLaunchAdapter adapter = adapter();
        JobExecution jobExecution = mock(JobExecution.class);
        when(jobExecution.getId()).thenReturn(77L);
        when(jobLauncher.run(eq(placeDataPipelineJob), any())).thenReturn(jobExecution);

        long executionId = adapter.launch(JOB_NAME, Map.of("runAt", RUN_AT), Map.of("trigger", "quartz"));

        assertThat(executionId).isEqualTo(77L);
    }

    @Test
    @DisplayName("runAt 만 identifying 이고 trigger 는 기록용이다")
    void marksOnlyIdentifyingParameters() throws Exception {
        SpringBatchJobLaunchAdapter adapter = adapter();
        JobExecution jobExecution = mock(JobExecution.class);
        when(jobExecution.getId()).thenReturn(1L);
        when(jobLauncher.run(eq(placeDataPipelineJob), any())).thenReturn(jobExecution);

        adapter.launch(JOB_NAME, Map.of("runAt", RUN_AT), Map.of("trigger", "quartz"));

        ArgumentCaptor<JobParameters> captor = ArgumentCaptor.forClass(JobParameters.class);
        verify(jobLauncher).run(eq(placeDataPipelineJob), captor.capture());
        JobParameters parameters = captor.getValue();
        assertThat(parameters.getString("runAt")).isEqualTo(RUN_AT);
        assertThat(parameters.getParameter("runAt").isIdentifying()).isTrue();
        assertThat(parameters.getParameter("trigger").isIdentifying()).isFalse();
    }

    @Test
    @DisplayName("컨텍스트에 없는 잡 이름이면 JOB_NOT_FOUND 로 실패한다")
    void failsForUnknownJobName() {
        SpringBatchJobLaunchAdapter adapter = adapter();

        assertThatThrownBy(() -> adapter.launch("unknownJob", Map.of("runAt", RUN_AT), Map.of()))
            .isInstanceOf(ScheduleException.class)
            .extracting(exception -> ((ScheduleException) exception).getErrorCode())
            .isEqualTo(ScheduleErrorCode.JOB_NOT_FOUND);
    }

    @Test
    @DisplayName("같은 이름의 Job 빈이 둘이면 DUPLICATE_JOB_NAME 으로 세운다")
    void failsWhenJobNamesCollide() {
        // 잡 이름은 스케줄과 --spring.batch.job.name 이 함께 쓰는 식별자라, 겹치면 어느 잡이
        // 도는지가 빈 배선 순서에 달린다. 조용히 하나를 고르면 안 된다.
        Job duplicate = mock(Job.class);
        when(placeDataPipelineJob.getName()).thenReturn(JOB_NAME);
        when(duplicate.getName()).thenReturn(JOB_NAME);

        assertThatThrownBy(() -> new SpringBatchJobLaunchAdapter(List.of(placeDataPipelineJob, duplicate), jobLauncher))
            .isInstanceOf(ScheduleException.class)
            .hasMessageContaining(JOB_NAME)
            .extracting(exception -> ((ScheduleException) exception).getErrorCode())
            .isEqualTo(ScheduleErrorCode.DUPLICATE_JOB_NAME);
    }

    @Test
    @DisplayName("같은 runAt 으로 이미 완료된 JobInstance 면 LAUNCH_FAILED 로 바꿔 던진다")
    void wrapsAlreadyCompleteInstance() throws Exception {
        SpringBatchJobLaunchAdapter adapter = adapter();
        when(jobLauncher.run(eq(placeDataPipelineJob), any()))
            .thenThrow(new JobInstanceAlreadyCompleteException("already complete"));

        assertThatThrownBy(() -> adapter.launch(JOB_NAME, Map.of("runAt", RUN_AT), Map.of()))
            .isInstanceOf(ScheduleException.class)
            .extracting(exception -> ((ScheduleException) exception).getErrorCode())
            .isEqualTo(ScheduleErrorCode.LAUNCH_FAILED);
    }
}
