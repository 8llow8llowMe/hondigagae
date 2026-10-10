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
 * <p><b>기본은 포털에서 직접 내려받는다</b> (data.go.kr/data/15043496). 상세 페이지의
 * JSON-LD 에서 파일 주소를 찾아 임시 디렉터리로 스트리밍하고, {@code atchFileId} 와
 * 바이트 수가 직전 적재와 같으면 적재를 통째로 건너뛴다.
 * {@code OLLE_COURSE_DOWNLOAD_ENABLED=false} 면 종전처럼 {@code olle-course.file-path} 의
 * 로컬 파일만 읽는다 — 포털이 막혔을 때도 이 파일로 물러난다.
 *
 * <p>실행 방법 (spring.batch.job.enabled=false 이므로 잡 이름을 지정해 수동 실행한다):
 * <pre>
 * ./gradlew :service:batch-service:bootRun --args="--spring.batch.job.enabled=true --spring.batch.job.name=olleCourseImportJob"
 * </pre>
 * JobParameters:
 * <ul>
 *   <li>{@code forceImport} — {@code true} 면 원천 파일이 직전과 같아도 다시 적재한다</li>
 *   <li>{@code runAt} — 재실행용 증분 파라미터</li>
 * </ul>
 * 사전 조건:
 * <ul>
 *   <li>walk_course 테이블 — 스키마 원천은 tour-service 의 WalkCourseEntity 다</li>
 * </ul>
 * 코스가 29건이고 TourAPI 호출이 1건이라 쿼터 부담이 없다. 장소 파이프라인에는 넣지 않는다.
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
