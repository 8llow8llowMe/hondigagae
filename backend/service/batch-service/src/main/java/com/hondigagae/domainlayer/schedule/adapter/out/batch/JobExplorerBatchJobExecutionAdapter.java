package com.hondigagae.domainlayer.schedule.adapter.out.batch;

import com.hondigagae.domainlayer.schedule.application.port.out.BatchJobExecutionQueryPort;
import com.hondigagae.domainlayer.schedule.application.port.out.query.RunningJobExecutionQueryResult;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Collection;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.batch.core.JobExecution;
import org.springframework.batch.core.explore.JobExplorer;
import org.springframework.stereotype.Component;

/**
 * 배치 메타데이터에서 실행 중인 잡을 읽는다.
 *
 * <p>Spring Batch 5 는 메타 시각을 시간대 없는 {@code LocalDateTime} 으로 저장하므로,
 * JVM 기본 시간대로 {@code Instant} 를 만든다 — 메타 행을 쓴 것도 같은 JVM 이다
 * ({@code PlaceImportMetricsSeeder} 와 같은 방식).
 *
 * <p>이름마다 한 번씩 부르는 것은 N+1 이 아니다. {@code JobExplorer} 에 이름 여러 개를 받는
 * 조회가 없고, 호출 대상은 발화 한 번에 최대 일곱 개인 상수 목록이다.
 */
@Component
@RequiredArgsConstructor
public class JobExplorerBatchJobExecutionAdapter implements BatchJobExecutionQueryPort {

    private final JobExplorer jobExplorer;

    @Override
    public List<RunningJobExecutionQueryResult> findRunning(Collection<String> jobNames) {
        return jobNames.stream()
            .flatMap(jobName -> jobExplorer.findRunningJobExecutions(jobName).stream()
                .map(execution -> toQueryResult(jobName, execution)))
            .toList();
    }

    private RunningJobExecutionQueryResult toQueryResult(String jobName, JobExecution execution) {
        LocalDateTime startedAt = execution.getStartTime() != null ? execution.getStartTime() : execution.getCreateTime();
        return new RunningJobExecutionQueryResult(
            jobName, execution.getId(), startedAt.atZone(ZoneId.systemDefault()).toInstant());
    }
}
