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
 * <p>원천은 공공데이터포털 파일데이터(CSV)다. 활용신청도 인증키도 필요 없다
 * (data.go.kr/data/15111389).
 *
 * <p><b>기본은 포털에서 직접 내려받는다</b> (#379). 상세 페이지의 JSON-LD 에서 파일 주소를 찾아
 * 임시 디렉터리로 스트리밍하고, {@code atchFileId} 와 바이트 수가 직전 적재와 같으면 적재를
 * 통째로 건너뛴다. {@code CULTURE_FACILITY_DOWNLOAD_ENABLED=false} 면 종전처럼
 * {@code culture-facility.file-path} 의 로컬 파일만 읽는다 — 포털이 막혔을 때도 이 파일로 물러난다.
 *
 * <p>실행 방법:
 * <pre>
 * ./gradlew :service:batch-service:bootRun --args="--spring.batch.job.enabled=true --spring.batch.job.name=cultureFacilityImportJob sido=제주특별자치도 runAt=&lt;ISO 시각&gt;"
 * </pre>
 * JobParameters:
 * <ul>
 *   <li>{@code sido} — 시도 명칭 (기본 제주특별자치도)</li>
 *   <li>{@code forceImport} — {@code true} 면 원천 파일이 직전과 같아도 다시 적재한다. 파서를 고친 뒤 재적재할 때 쓴다</li>
 *   <li>{@code runAt} — 재실행용 증분 파라미터. 같은 값으로 다시 돌리면 JobInstance 가 이미 완료라 실패한다</li>
 * </ul>
 *
 * <p>병합은 {@code placeMergeJob} 을 이어 돌린다 (#363).
 * 다섯 잡을 한 번에 돌리려면 {@code placeDataPipelineJob} 을 쓴다 (#377).
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
