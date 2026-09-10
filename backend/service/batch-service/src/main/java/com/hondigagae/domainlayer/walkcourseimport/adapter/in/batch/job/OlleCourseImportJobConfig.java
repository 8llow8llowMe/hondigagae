package com.hondigagae.domainlayer.walkcourseimport.adapter.in.batch.job;

import com.hondigagae.domainlayer.walkcourseimport.adapter.in.batch.tasklet.OlleCourseImportTasklet;
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
 * 제주올레 코스 적재 잡.
 *
 * <p>실행 방법 (spring.batch.job.enabled=false 이므로 잡 이름을 지정해 수동 실행한다):
 * <pre>
 * ./gradlew :service:batch-service:bootRun --args="--spring.batch.job.enabled=true --spring.batch.job.name=olleCourseImportJob"
 * </pre>
 * 사전 조건:
 * <ul>
 *   <li>CSV — data.go.kr/data/15043496 에서 받아 {@code OLLE_COURSE_CSV_PATH}(기본 data/olle_course.csv)에 둔다.
 *       원본이 CP949 라도 어댑터가 판별해 읽는다</li>
 *   <li>walk_course 테이블 — 스키마 원천은 tour-service 의 WalkCourseEntity 다. 로컬에서는 tour-service 를
 *       먼저 한 번 기동해 테이블을 만든다</li>
 * </ul>
 * 같은 파라미터로 재실행하려면 {@code runAt=<timestamp>} 같은 증분 파라미터를 추가한다.
 * 코스가 29건이고 TourAPI 호출이 1건이라 쿼터 부담이 없다.
 */
@Configuration
public class OlleCourseImportJobConfig {

    public static final String JOB_NAME = "olleCourseImportJob";
    private static final String STEP_NAME = "olleCourseImportStep";

    @Bean
    public Job olleCourseImportJob(JobRepository jobRepository, Step olleCourseImportStep) {
        return new JobBuilder(JOB_NAME, jobRepository)
            .start(olleCourseImportStep)
            .build();
    }

    // 스텝에는 무자원 매니저를 쓴다 - HTTP 호출을 품은 tasklet 전체가 한 DB 트랜잭션으로 묶이면
    // 실행 내내 row lock 을 쥔다 (BatchServiceBeansConfig.taskletTransactionManager 참고).
    @Bean
    public Step olleCourseImportStep(
        JobRepository jobRepository,
        @Qualifier("taskletTransactionManager") PlatformTransactionManager taskletTransactionManager,
        OlleCourseImportTasklet olleCourseImportTasklet
    ) {
        return new StepBuilder(STEP_NAME, jobRepository)
            .tasklet(olleCourseImportTasklet, taskletTransactionManager)
            .build();
    }
}
