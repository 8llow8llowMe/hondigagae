package com.hondigagae.domainlayer.placeimport.adapter.in.batch.job;

import com.hondigagae.domainlayer.placeimport.adapter.in.batch.tasklet.PetRestaurantImportTasklet;
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
 * 식약처 반려동물 동반출입 음식점 적재 잡.
 *
 * <p>원천은 식품안전나라의 등록 업소 현황(xlsx)이다. 인증키가 필요 없고, 좌표는 VWorld
 * 지오코더로 채우므로 {@code vworld.api-key} 가 있어야 한다.
 *
 * <p>실행 방법:
 * <pre>
 * ./gradlew :service:batch-service:bootRun --args="--spring.batch.job.enabled=true --spring.batch.job.name=petRestaurantImportJob region=제주"
 * </pre>
 * JobParameters:
 * <ul>
 *   <li>{@code region} — 원천의 지역 표기 (기본 제주)</li>
 * </ul>
 *
 * <p>등록 업소가 계속 느는 원천이라 주기 실행이 전제다. 재실행은 멱등이다.
 */
@Configuration
public class PetRestaurantImportJobConfig {

    public static final String JOB_NAME = "petRestaurantImportJob";
    private static final String STEP_NAME = "petRestaurantImportStep";

    @Bean
    public Job petRestaurantImportJob(JobRepository jobRepository, Step petRestaurantImportStep) {
        return new JobBuilder(JOB_NAME, jobRepository)
            .start(petRestaurantImportStep)
            .build();
    }

    // 무자원 매니저 사용 이유는 BatchServiceBeansConfig.taskletTransactionManager 참고.
    @Bean
    public Step petRestaurantImportStep(
        JobRepository jobRepository,
        @Qualifier("taskletTransactionManager") PlatformTransactionManager taskletTransactionManager,
        PetRestaurantImportTasklet petRestaurantImportTasklet
    ) {
        return new StepBuilder(STEP_NAME, jobRepository)
            .tasklet(petRestaurantImportTasklet, taskletTransactionManager)
            .build();
    }
}
