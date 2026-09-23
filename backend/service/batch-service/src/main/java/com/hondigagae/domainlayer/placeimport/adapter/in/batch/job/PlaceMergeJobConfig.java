package com.hondigagae.domainlayer.placeimport.adapter.in.batch.job;

import com.hondigagae.domainlayer.placeimport.adapter.in.batch.tasklet.PlaceMergeTasklet;
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
 * 원천이 다른 같은 장소를 하나로 묶는 중복 병합 잡.
 *
 * <p>관광 API 행을 살리고 문화정보원 행에 {@code merged_into_id} 를 채워 조회에서 빠지게 한다.
 * 판정 규칙은 {@code PlaceMergeProcessor} 와 {@code PlaceIdentityPolicy} 를 본다.
 *
 * <p><b>실행 순서</b>: 적재가 모두 끝난 뒤 한 번 돌린다. 예전에는 각 적재 파사드가 자기 적재 뒤에
 * 병합을 불러서 아직 다른 원천이 들어오지 않은 중간 상태로 판정했다(#363).
 * <pre>
 * placeImportJob → cultureFacilityImportJob → petRestaurantImportJob → <b>placeMergeJob</b> → placeImageBackfillJob
 *   → petTourImportJob
 * </pre>
 * 재실행은 멱등이다(이미 병합된 행은 후보에서 빠진다).
 * <pre>
 * java -jar batch.jar --spring.batch.job.enabled=true --spring.batch.job.name=placeMergeJob areaCode=39 runAt=&lt;ISO 시각&gt;
 * </pre>
 * JobParameters:
 * <ul>
 *   <li>{@code areaCode} — 관광 지역코드 (기본 39). 적재 범위와 같은 값을 넣는다</li>
 *   <li>{@code runAt} — 실행마다 새로 주는 식별 파라미터(ISO 시각). 같은 값으로는 다시 돌지 않는다</li>
 * </ul>
 */
@Configuration
public class PlaceMergeJobConfig {

    public static final String JOB_NAME = "placeMergeJob";
    private static final String STEP_NAME = "placeMergeStep";

    @Bean
    public Job placeMergeJob(JobRepository jobRepository, Step placeMergeStep) {
        return new JobBuilder(JOB_NAME, jobRepository)
            .start(placeMergeStep)
            .build();
    }

    // 무자원 매니저 사용 이유는 BatchServiceBeansConfig.taskletTransactionManager 참고.
    @Bean
    public Step placeMergeStep(
        JobRepository jobRepository,
        @Qualifier("taskletTransactionManager") PlatformTransactionManager taskletTransactionManager,
        PlaceMergeTasklet placeMergeTasklet
    ) {
        return new StepBuilder(STEP_NAME, jobRepository)
            .tasklet(placeMergeTasklet, taskletTransactionManager)
            .build();
    }
}
