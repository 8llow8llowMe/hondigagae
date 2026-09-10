package com.hondigagae.domainlayer.placeimport.adapter.in.batch.job;

import com.hondigagae.domainlayer.placeimport.adapter.in.batch.tasklet.PlaceImageImportTasklet;
import com.hondigagae.domainlayer.placeimport.adapter.in.batch.tasklet.PlaceImportTasklet;
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
 * TourAPI 장소 적재 잡.
 *
 * <p>실행 방법 (spring.batch.job.enabled=false 이므로 잡 이름을 지정해 수동 실행한다):
 * <pre>
 * ./gradlew :service:batch-service:bootRun --args="--spring.batch.job.enabled=true --spring.batch.job.name=placeImportJob areaCode=39 runAt=&lt;ISO 시각&gt;"
 * </pre>
 * JobParameters:
 * <ul>
 *   <li>{@code areaCode} — TourAPI 지역코드 (기본 39=제주)</li>
 *   <li>{@code contentTypeIds} — 콤마 구분 contentTypeId 목록 (생략 시 기본 대상 7종, 예: "12,39")</li>
 *   <li>{@code runAt} — 재실행용 증분 파라미터. 같은 값으로 다시 돌리면 JobInstance 가 이미 완료라 실패한다</li>
 * </ul>
 *
 * <p>{@code placeDataPipelineJob} 의 첫 단계이기도 하다 (#377). 단독 실행도 그대로 된다.
 */
@Configuration
public class PlaceImportJobConfig {

    public static final String JOB_NAME = "placeImportJob";
    private static final String STEP_NAME = "placeImportStep";
    private static final String IMAGE_STEP_NAME = "placeImageImportStep";

    @Bean
    public Job placeImportJob(JobRepository jobRepository, Step placeImportStep, Step placeImageImportStep) {
        return new JobBuilder(JOB_NAME, jobRepository)
            .start(placeImportStep)
            // 이미지 적재는 장소 적재 뒤에 돈다 — place 테이블의 TourAPI 행이 대상 목록이다.
            .next(placeImageImportStep)
            .build();
    }

    // 스텝에는 무자원 매니저를 쓴다 — HTTP 페이징을 품은 tasklet 전체가 한 DB 트랜잭션으로
    // 묶이면 실행 내내 row lock 을 쥔다 (BatchServiceBeansConfig.taskletTransactionManager 참고).
    @Bean
    public Step placeImportStep(
        JobRepository jobRepository,
        @Qualifier("taskletTransactionManager") PlatformTransactionManager taskletTransactionManager,
        PlaceImportTasklet placeImportTasklet
    ) {
        return new StepBuilder(STEP_NAME, jobRepository)
            .tasklet(placeImportTasklet, taskletTransactionManager)
            .build();
    }

    @Bean
    public Step placeImageImportStep(
        JobRepository jobRepository,
        @Qualifier("taskletTransactionManager") PlatformTransactionManager taskletTransactionManager,
        PlaceImageImportTasklet placeImageImportTasklet
    ) {
        return new StepBuilder(IMAGE_STEP_NAME, jobRepository)
            .tasklet(placeImageImportTasklet, taskletTransactionManager)
            .build();
    }
}
