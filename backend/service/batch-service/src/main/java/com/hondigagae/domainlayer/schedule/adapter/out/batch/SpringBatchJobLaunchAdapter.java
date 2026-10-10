package com.hondigagae.domainlayer.schedule.adapter.out.batch;

import com.hondigagae.domainlayer.schedule.application.exception.ScheduleErrorCode;
import com.hondigagae.domainlayer.schedule.application.exception.ScheduleException;
import com.hondigagae.domainlayer.schedule.application.port.out.BatchJobLaunchPort;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.batch.core.Job;
import org.springframework.batch.core.JobParametersBuilder;
import org.springframework.batch.core.JobParametersInvalidException;
import org.springframework.batch.core.launch.JobLauncher;
import org.springframework.batch.core.repository.JobExecutionAlreadyRunningException;
import org.springframework.batch.core.repository.JobInstanceAlreadyCompleteException;
import org.springframework.batch.core.repository.JobRestartException;
import org.springframework.stereotype.Component;

/**
 * 이름으로 {@code Job} 빈을 찾아 {@code JobLauncher} 로 띄운다.
 *
 * <p>{@code JobRegistry} 를 쓰지 않고 {@code List<Job>} 을 직접 받아 인덱싱한다.
 * 레지스트리 등록은 자동 구성 시점에 달려 있어 "왜 이 잡만 없지"가 기동 순서 문제로 번지는데,
 * 컨텍스트에 있는 {@code Job} 빈 전부를 받으면 그 불확실성이 사라진다.
 * 잡 이름은 빈 이름이 아니라 {@code Job.getName()} 을 쓴다 — 스케줄이 부르는 이름은
 * {@code --spring.batch.job.name} 에 넣는 이름과 같아야 한다.
 */
@Component
public class SpringBatchJobLaunchAdapter implements BatchJobLaunchPort {

    private final Map<String, Job> jobsByName;
    private final JobLauncher jobLauncher;

    public SpringBatchJobLaunchAdapter(List<Job> jobs, JobLauncher jobLauncher) {
        this.jobsByName = indexByName(jobs);
        this.jobLauncher = jobLauncher;
    }

    /**
     * 이름이 겹치면 기동을 세운다.
     *
     * <p>병합 함수를 주지 않으면 {@code toUnmodifiableMap} 이 {@code IllegalStateException}
     * ({@code Duplicate key ...})으로 죽는데, 그 메시지에는 {@code Job} 의 {@code toString()} 두 개가
     * 실릴 뿐이라 어느 이름이 겹쳤는지 읽어내기 어렵다. 잡 이름은 스케줄과 수동 실행
     * ({@code --spring.batch.job.name})이 함께 쓰는 식별자여서, 겹치면 <b>어느 잡이 도는지가 빈 배선
     * 순서에 달리게 된다</b>. 조용히 하나를 고르는 대신 이름을 밝혀 세운다.
     */
    private static Map<String, Job> indexByName(List<Job> jobs) {
        return jobs.stream().collect(Collectors.toUnmodifiableMap(
            Job::getName,
            Function.identity(),
            (first, second) -> {
                throw new ScheduleException(ScheduleErrorCode.DUPLICATE_JOB_NAME, first.getName());
            }));
    }

    @Override
    public long launch(String jobName, Map<String, String> identifyingParameters, Map<String, String> nonIdentifyingParameters) {
        Job job = jobsByName.get(jobName);
        if (job == null) {
            throw new ScheduleException(ScheduleErrorCode.JOB_NOT_FOUND, jobName);
        }

        JobParametersBuilder parametersBuilder = new JobParametersBuilder();
        identifyingParameters.forEach((key, value) -> parametersBuilder.addString(key, value, true));
        nonIdentifyingParameters.forEach((key, value) -> parametersBuilder.addString(key, value, false));

        try {
            Long executionId = jobLauncher.run(job, parametersBuilder.toJobParameters()).getId();
            if (executionId == null) {
                throw new ScheduleException(ScheduleErrorCode.LAUNCH_FAILED, jobName);
            }
            return executionId;
        } catch (JobExecutionAlreadyRunningException | JobRestartException
                 | JobInstanceAlreadyCompleteException | JobParametersInvalidException exception) {
            throw new ScheduleException(ScheduleErrorCode.LAUNCH_FAILED, exception, jobName);
        }
    }
}
