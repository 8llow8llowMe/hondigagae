package com.hondigagae.domainlayer.placeimport.adapter.in.batch.job;

import com.hondigagae.domainlayer.placeimport.adapter.in.batch.tasklet.CultureFacilityImportTasklet;
import org.springframework.batch.core.Job;
import org.springframework.batch.core.Step;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.builder.StepBuilder;
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
 * <p>적재 후 같은 스텝에서 중복 병합까지 수행한다 — 관광 API 로 이미 들어온 장소와 겹치는 행에
 * {@code merged_into_id} 를 채워 조회에서 빠지게 한다.
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

    @Bean
    public Step cultureFacilityImportStep(
        JobRepository jobRepository,
        PlatformTransactionManager transactionManager,
        CultureFacilityImportTasklet cultureFacilityImportTasklet
    ) {
        return new StepBuilder(STEP_NAME, jobRepository)
            .tasklet(cultureFacilityImportTasklet, transactionManager)
            .build();
    }
}
