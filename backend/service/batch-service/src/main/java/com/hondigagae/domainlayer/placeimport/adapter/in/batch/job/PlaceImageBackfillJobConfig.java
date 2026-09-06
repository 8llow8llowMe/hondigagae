package com.hondigagae.domainlayer.placeimport.adapter.in.batch.job;

import com.hondigagae.domainlayer.placeimport.adapter.in.batch.tasklet.PlaceImageBackfillTasklet;
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
 * 문화정보원·식약처 원천 장소의 대표 이미지 백필 잡.
 *
 * <p>두 원천에는 이미지 필드가 없어, 같은 장소가 TourAPI 에 있으면 그쪽 대표 이미지를
 * 빌려 온다 (정규화 제목 일치 + 좌표 500m 이중 검증 — 자세한 규칙은
 * {@code PlaceImageBackfillProcessor}).
 *
 * <p><b>실행 순서</b>: cultureFacilityImportJob·petRestaurantImportJob 이후에 돌려야 한다 —
 * place 테이블의 이미지 없는 행이 대상 목록이다. 재실행은 멱등이다(이미 채워진 행은 대상에서 빠진다).
 * <pre>
 * java -jar batch.jar --spring.batch.job.enabled=true --spring.batch.job.name=placeImageBackfillJob areaCode=39 runAt=&lt;고유값&gt;
 * </pre>
 */
@Configuration
public class PlaceImageBackfillJobConfig {

    public static final String JOB_NAME = "placeImageBackfillJob";
    private static final String STEP_NAME = "placeImageBackfillStep";

    @Bean
    public Job placeImageBackfillJob(JobRepository jobRepository, Step placeImageBackfillStep) {
        return new JobBuilder(JOB_NAME, jobRepository)
            .start(placeImageBackfillStep)
            .build();
    }

    // 무자원 매니저 사용 이유는 BatchServiceBeansConfig.taskletTransactionManager 참고.
    @Bean
    public Step placeImageBackfillStep(
        JobRepository jobRepository,
        @Qualifier("taskletTransactionManager") PlatformTransactionManager taskletTransactionManager,
        PlaceImageBackfillTasklet placeImageBackfillTasklet
    ) {
        return new StepBuilder(STEP_NAME, jobRepository)
            .tasklet(placeImageBackfillTasklet, taskletTransactionManager)
            .build();
    }
}
