package com.hondigagae.domainlayer.placeimport.adapter.in.batch.job;

import com.hondigagae.domainlayer.placeimport.adapter.in.batch.tasklet.CultureFacilityImportTasklet;
import org.springframework.batch.core.Job;
import org.springframework.batch.core.Step;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;

/**
 * 문화정보원 문화시설 적재 잡.
 *
 * <p>원천은 공공데이터포털 파일데이터(CSV)다. 활용신청도 인증키도 필요 없고
 * {@code culture-facility.file-path} 로 경로만 지정한다 (data.go.kr/data/15111389).
 *
 * <p>실행 방법:
 * <pre>
 * ./gradlew :service:batch-service:bootRun --args="--spring.batch.job.enabled=true --spring.batch.job.name=cultureFacilityImportJob sido=제주특별자치도"
 * </pre>
 * JobParameters:
 * <ul>
 *   <li>{@code sido} — 시도 명칭 (기본 제주특별자치도)</li>
 * </ul>
 *
 * <p>병합은 {@code placeMergeJob} 을 이어 돌린다 (#363).
 */
@Configuration
public class CultureFacilityImportJobConfig {

    public static final String JOB_NAME = "cultureFacilityImportJob";
    private static final String STEP_NAME = "cultureFacilityImportStep";

    @Bean
    public Job cultureFacilityImportJob(JobRepository jobRepository, Step cultureFacilityImportStep) {
        return new JobBuilder(JOB_NAME, jobRepository)
            .start(cultureFacilityImportStep)
            .build();
    }

    // 무자원 매니저 사용 이유는 BatchServiceBeansConfig.taskletTransactionManager 참고.
    @Bean
    public Step cultureFacilityImportStep(
        JobRepository jobRepository,
        @Qualifier("taskletTransactionManager") PlatformTransactionManager taskletTransactionManager,
        CultureFacilityImportTasklet cultureFacilityImportTasklet
    ) {
        return new StepBuilder(STEP_NAME, jobRepository)
            .tasklet(cultureFacilityImportTasklet, taskletTransactionManager)
            .build();
    }
}
