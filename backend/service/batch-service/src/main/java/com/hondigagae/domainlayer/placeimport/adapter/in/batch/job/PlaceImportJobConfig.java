package com.hondigagae.domainlayer.placeimport.adapter.in.batch.job;

import com.hondigagae.domainlayer.placeimport.adapter.in.batch.tasklet.PlaceImportTasklet;
import org.springframework.batch.core.Job;
import org.springframework.batch.core.Step;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;

/**
 * TourAPI 장소 적재 잡.
 *
 * <p>실행 방법 (spring.batch.job.enabled=false 이므로 잡 이름을 지정해 수동 실행한다):
 * <pre>
 * ./gradlew :service:batch-service:bootRun --args="--spring.batch.job.enabled=true --spring.batch.job.name=placeImportJob areaCode=39"
 * </pre>
 * JobParameters:
 * <ul>
 *   <li>{@code areaCode} — TourAPI 지역코드 (기본 39=제주)</li>
 *   <li>{@code contentTypeIds} — 콤마 구분 contentTypeId 목록 (생략 시 기본 대상 7종, 예: "12,39")</li>
 * </ul>
 * 같은 파라미터로 재실행하려면 run.id 같은 증분 파라미터를 추가하거나 기존 JobInstance를 정리한다.
 */
@Configuration
public class PlaceImportJobConfig {

    public static final String JOB_NAME = "placeImportJob";
    private static final String STEP_NAME = "placeImportStep";

    @Bean
    public Job placeImportJob(JobRepository jobRepository, Step placeImportStep) {
        return new JobBuilder(JOB_NAME, jobRepository)
            .start(placeImportStep)
            .build();
    }

    @Bean
    public Step placeImportStep(
        JobRepository jobRepository,
        PlatformTransactionManager transactionManager,
        PlaceImportTasklet placeImportTasklet
    ) {
        return new StepBuilder(STEP_NAME, jobRepository)
            .tasklet(placeImportTasklet, transactionManager)
            .build();
    }
}
