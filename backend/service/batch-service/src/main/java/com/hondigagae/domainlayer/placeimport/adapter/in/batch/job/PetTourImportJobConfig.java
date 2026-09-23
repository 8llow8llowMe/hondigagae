package com.hondigagae.domainlayer.placeimport.adapter.in.batch.job;

import com.hondigagae.domainlayer.placeimport.adapter.in.batch.tasklet.PetTourImportTasklet;
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
 * 반려동물 동반 조건 적재 잡 (#877). place_pet_info 를 채운다.
 *
 * <p>실행 방법:
 * <pre>
 * java -jar batch.jar --spring.batch.job.enabled=true --spring.batch.job.name=petTourImportJob areaCode=39 runAt=&lt;ISO 시각&gt;
 * </pre>
 * JobParameters: {@code areaCode} (기본 39=제주), {@code runAt} (재실행용 증분 파라미터).
 *
 * <p><b>대상과 쿼터</b> (2026-09-23 실측):
 * <ol>
 *   <li>petTourSyncList2 {@code lDongRegnCd=50} — 제주 336건(노출 330 · 내림 6), 1콜.
 *       {@code areaCode=39} 로 물으면 31건뿐이다 (#726 과 같은 함정)</li>
 *   <li>detailPetTour2 — 노출 집합 ∩ place 마스터에만. 장소당 1콜, 실행당 상한 350</li>
 * </ol>
 * 반려동물 동반여행 서비스의 쿼터는 KorService2 와 따로 세므로({@code PetTourImportProperties})
 * {@code placeImportJob} 의 예산과 경쟁하지 않는다.
 *
 * <p>{@code placeDataPipelineJob} 의 마지막 단계이기도 하다. 단독 실행도 그대로 된다.
 */
@Configuration
public class PetTourImportJobConfig {

    public static final String JOB_NAME = "petTourImportJob";
    private static final String STEP_NAME = "petTourImportStep";

    @Bean
    public Job petTourImportJob(JobRepository jobRepository, Step petTourImportStep) {
        return new JobBuilder(JOB_NAME, jobRepository)
            .start(petTourImportStep)
            .build();
    }

    // 무자원 매니저 사용 이유는 BatchServiceBeansConfig.taskletTransactionManager 참고.
    @Bean
    public Step petTourImportStep(
        JobRepository jobRepository,
        @Qualifier("taskletTransactionManager") PlatformTransactionManager taskletTransactionManager,
        PetTourImportTasklet petTourImportTasklet
    ) {
        return new StepBuilder(STEP_NAME, jobRepository)
            .tasklet(petTourImportTasklet, taskletTransactionManager)
            .build();
    }
}
