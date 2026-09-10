package com.hondigagae.domainlayer.placeimport.adapter.in.batch.listener;

import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.batch.core.BatchStatus;
import org.springframework.batch.core.ExitStatus;
import org.springframework.batch.core.JobExecution;
import org.springframework.batch.core.JobExecutionListener;
import org.springframework.batch.core.StepExecution;
import org.springframework.stereotype.Component;

/**
 * 자식 스텝이 하나라도 실패했으면 부모 잡을 FAILED 로 내리는 리스너.
 *
 * <p>{@code placeDataPipelineJob} 은 {@code .on("*")} 로 실패한 스텝 뒤에도 다음 단계로 넘긴다
 * (모두 멱등이라 하나가 죽어도 나머지는 돌 값어치가 있다). 그런데 그렇게만 두면 스텝이 FAILED 여도
 * 플로우 자체는 끝까지 흘러 <b>부모 JobExecution 이 COMPLETED 로 남는다.</b>
 * {@code BATCH_JOB_EXECUTION} 만 보는 사람은 실패를 영영 모르고, 종료코드로 성공을 판단하는
 * cron·모니터링도 조용히 통과시킨다. 그래서 여기서 부모 상태를 내린다.
 *
 * <p>{@code AbstractJob.execute} 는 {@code afterJob} 을 부른 <b>뒤에</b>
 * {@code jobRepository.update(execution)} 을 하므로 여기서 바꾼 상태가 그대로 저장된다.
 *
 * <p>실패 판정은 {@code BatchStatus.isUnsuccessful()} 이다 — FAILED 뿐 아니라 롤백 실패(UNKNOWN)·
 * 포기(ABANDONED)도 exit status 가 {@code *} 에 매치돼 흐름이 끝까지 가므로 같이 잡아야 한다.
 *
 * <p>실패한 스텝이 없으면 아무것도 손대지 않는다 — 잡 자체가 다른 이유로 이미 FAILED/STOPPED 인
 * 경우를 COMPLETED 로 되돌리면 안 된다. {@code beforeJob} 은 인터페이스 기본 구현(빈 메서드)을 쓴다.
 *
 * <p>Micrometer 의 {@code spring.batch.job} 관측은 {@code afterJob} <b>앞</b>에서 닫히므로 그 태그에는
 * 강등 전 상태가 남는다. 경보는 이 태그가 아니라 BATCH_* 메타와 {@code place_import_*} 지표를 본다.
 */
@Slf4j
@Component
public class PipelineExitStatusListener implements JobExecutionListener {

    private static final String FAILED_STEPS_PREFIX = "failedSteps=";

    @Override
    public void afterJob(JobExecution jobExecution) {
        String failedStepNames = jobExecution.getStepExecutions().stream()
            .filter(stepExecution -> stepExecution.getStatus().isUnsuccessful())
            .map(StepExecution::getStepName)
            .collect(Collectors.joining(","));

        if (failedStepNames.isEmpty()) {
            return;
        }

        log.error("pipeline job downgraded to FAILED. jobExecutionId={}, failedSteps={}", jobExecution.getId(), failedStepNames);
        jobExecution.setStatus(BatchStatus.FAILED);
        jobExecution.setExitStatus(new ExitStatus(ExitStatus.FAILED.getExitCode(), FAILED_STEPS_PREFIX + failedStepNames));
    }
}
