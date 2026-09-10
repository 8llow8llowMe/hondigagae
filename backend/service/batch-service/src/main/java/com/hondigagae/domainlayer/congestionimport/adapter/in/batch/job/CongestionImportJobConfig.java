package com.hondigagae.domainlayer.congestionimport.adapter.in.batch.job;

import com.hondigagae.domainlayer.congestionimport.adapter.in.batch.tasklet.CongestionImportTasklet;
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
 * 관광지 집중률 예측 적재 잡.
 *
 * <p>실행 방법 (spring.batch.job.enabled=false 이므로 잡 이름을 지정해 수동 실행한다):
 * <pre>
 * ./gradlew :service:batch-service:bootRun --args="--spring.batch.job.enabled=true --spring.batch.job.name=congestionImportJob runAt=&lt;ISO 시각&gt;"
 * </pre>
 * JobParameters:
 * <ul>
 *   <li>{@code numOfRows} - 페이지 크기 (기본 1000)</li>
 *   <li>{@code runAt} — 재실행용 증분 파라미터. 같은 값으로 다시 돌리면 JobInstance 가 이미 완료라 실패한다</li>
 * </ul>
 *
 * <p><b>placeImportJob 이후에 돌려야 한다.</b> 이 잡은 원천 명칭을 장소 마스터와 이어 붙이는데,
 * 장소가 비어 있으면 전부 UNMATCHED 로 적재되고 적합도 응답에서 혼잡도가 계속 빠진다.
 *
 * <p>30일 rolling 원천이라 <b>일 1회 주기 실행</b>이 전제다. 장소 적재는 주 1회라 주기가 달라
 * {@code placeDataPipelineJob} 에는 넣지 않았다 (#377) — 파이프라인 뒤에 따로 부른다.
 */
@Configuration
public class CongestionImportJobConfig {

    public static final String JOB_NAME = "congestionImportJob";
    private static final String STEP_NAME = "congestionImportStep";

    @Bean
    public Job congestionImportJob(JobRepository jobRepository, Step congestionImportStep) {
        return new JobBuilder(JOB_NAME, jobRepository)
            .start(congestionImportStep)
            .build();
    }

    // 무자원 매니저 사용 이유는 BatchServiceBeansConfig.taskletTransactionManager 참고.
    @Bean
    public Step congestionImportStep(
        JobRepository jobRepository,
        @Qualifier("taskletTransactionManager") PlatformTransactionManager taskletTransactionManager,
        CongestionImportTasklet congestionImportTasklet
    ) {
        return new StepBuilder(STEP_NAME, jobRepository)
            .tasklet(congestionImportTasklet, taskletTransactionManager)
            .build();
    }
}
