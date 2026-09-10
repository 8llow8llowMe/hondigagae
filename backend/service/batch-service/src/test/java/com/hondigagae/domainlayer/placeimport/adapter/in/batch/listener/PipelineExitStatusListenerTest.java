package com.hondigagae.domainlayer.placeimport.adapter.in.batch.listener;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.batch.core.BatchStatus;
import org.springframework.batch.core.ExitStatus;
import org.springframework.batch.core.JobExecution;
import org.springframework.batch.core.JobParameters;
import org.springframework.batch.core.StepExecution;

/**
 * 파이프라인이 자식 실패를 삼키지 않는지 고정한다.
 *
 * <p>{@code .on("*")} 로 계속 가는 구성은 편하지만, 이 리스너가 빠지면 스텝이 FAILED 여도
 * 부모가 COMPLETED 로 저장된다 — 실패가 조용해지는 쪽이 데이터가 낡는 것보다 위험하다.
 */
class PipelineExitStatusListenerTest {

    private final PipelineExitStatusListener listener = new PipelineExitStatusListener();

    @Test
    @DisplayName("스텝이 하나라도 FAILED 면 부모를 FAILED 로 내리고 실패한 스텝 이름을 남긴다")
    void downgradesParentWhenAnyStepFailed() {
        JobExecution jobExecution = new JobExecution(1L, new JobParameters());
        completedStep(jobExecution, "placeImportJobStep");
        failedStep(jobExecution, "petRestaurantImportJobStep");
        completedStep(jobExecution, "placeMergeJobStep");
        jobExecution.setStatus(BatchStatus.COMPLETED);
        jobExecution.setExitStatus(ExitStatus.COMPLETED);

        listener.afterJob(jobExecution);

        assertThat(jobExecution.getStatus()).isEqualTo(BatchStatus.FAILED);
        assertThat(jobExecution.getExitStatus().getExitCode()).isEqualTo("FAILED");
        assertThat(jobExecution.getExitStatus().getExitDescription()).contains("petRestaurantImportJobStep");
    }

    @Test
    @DisplayName("실패한 스텝이 둘이면 이름을 모두 남긴다")
    void listsEveryFailedStepName() {
        JobExecution jobExecution = new JobExecution(2L, new JobParameters());
        failedStep(jobExecution, "cultureFacilityImportJobStep");
        failedStep(jobExecution, "placeImageBackfillJobStep");

        listener.afterJob(jobExecution);

        assertThat(jobExecution.getExitStatus().getExitDescription())
            .contains("cultureFacilityImportJobStep")
            .contains("placeImageBackfillJobStep");
    }

    @Test
    @DisplayName("모든 스텝이 COMPLETED 면 상태를 손대지 않는다")
    void keepsStatusWhenEveryStepCompleted() {
        JobExecution jobExecution = new JobExecution(3L, new JobParameters());
        completedStep(jobExecution, "placeImportJobStep");
        completedStep(jobExecution, "placeMergeJobStep");
        jobExecution.setStatus(BatchStatus.COMPLETED);
        jobExecution.setExitStatus(ExitStatus.COMPLETED);

        listener.afterJob(jobExecution);

        assertThat(jobExecution.getStatus()).isEqualTo(BatchStatus.COMPLETED);
        assertThat(jobExecution.getExitStatus().getExitCode()).isEqualTo(ExitStatus.COMPLETED.getExitCode());
    }

    @Test
    @DisplayName("스텝이 하나도 없으면 상태를 손대지 않는다")
    void keepsStatusWhenNoStepRan() {
        // 스텝이 시작되기 전에 잡이 죽은 경우다(예: restart 경로의 검증 실패). 그때의 FAILED 를 덮으면 안 된다.
        // (첫 실행의 파라미터 검증 실패는 JobExecution 이 만들어지기 전이라 afterJob 자체가 불리지 않는다.)
        JobExecution jobExecution = new JobExecution(4L, new JobParameters());
        jobExecution.setStatus(BatchStatus.FAILED);
        jobExecution.setExitStatus(ExitStatus.FAILED.addExitDescription("JobParametersInvalidException"));

        listener.afterJob(jobExecution);

        assertThat(jobExecution.getStatus()).isEqualTo(BatchStatus.FAILED);
        assertThat(jobExecution.getExitStatus().getExitDescription()).isEqualTo("JobParametersInvalidException");
    }

    @Test
    @DisplayName("롤백 실패(UNKNOWN)·포기(ABANDONED)도 실패로 본다 — FAILED 만 보면 가장 위험한 종류가 빠져나간다")
    void treatsUnknownAndAbandonedAsFailure() {
        JobExecution jobExecution = new JobExecution(5L, new JobParameters());
        jobExecution.setStatus(BatchStatus.COMPLETED);
        completedStep(jobExecution, "placeImportJobStep");
        StepExecution unknown = jobExecution.createStepExecution("petRestaurantImportJobStep");
        unknown.setStatus(BatchStatus.UNKNOWN);
        StepExecution abandoned = jobExecution.createStepExecution("placeMergeJobStep");
        abandoned.setStatus(BatchStatus.ABANDONED);

        listener.afterJob(jobExecution);

        assertThat(jobExecution.getStatus()).isEqualTo(BatchStatus.FAILED);
        assertThat(jobExecution.getExitStatus().getExitDescription())
            .isEqualTo("failedSteps=petRestaurantImportJobStep,placeMergeJobStep");
    }

    private void completedStep(JobExecution jobExecution, String stepName) {
        StepExecution stepExecution = jobExecution.createStepExecution(stepName);
        stepExecution.setStatus(BatchStatus.COMPLETED);
    }

    private void failedStep(JobExecution jobExecution, String stepName) {
        StepExecution stepExecution = jobExecution.createStepExecution(stepName);
        stepExecution.setStatus(BatchStatus.FAILED);
    }
}
