package com.hondigagae.domainlayer.placeimport.adapter.in.batch.job;

import com.hondigagae.domainlayer.placeimport.adapter.in.batch.tasklet.PlacePetAllowanceReflectTasklet;
import org.springframework.batch.core.Step;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;

/**
 * 동반 가능 여부 재계산 스텝 (#886). 잡이 아니라 스텝 하나만 정의한다 — 두 잡이 같은 정의를 마지막 단계로 붙인다.
 * <pre>
 * petTourImportJob : petTourImportStep → <b>placePetAllowanceReflectStep</b>   (place_pet_info 가 바뀐 뒤)
 * placeMergeJob    : placeMergeStep    → <b>placePetAllowanceReflectStep</b>   (흡수 관계가 바뀐 뒤)
 * </pre>
 * 파이프라인에서는 병합(4) → … → 반려동물(6) 순이라 두 번 돌지만 근거 읽기 한 번 + 바뀐 행만 갱신이라 싸고, 두 번째는
 * 그사이 바뀐 동반 정보만큼만 갱신한다. 둘 중 하나만 손으로 돌려도 반영된다. 두 벌로 복사하면 한쪽만 고쳐지는 일이
 * 생기므로 한 정의를 쓴다.
 */
@Configuration
public class PlacePetAllowanceReflectStepConfig {

    public static final String STEP_NAME = "placePetAllowanceReflectStep";

    // 무자원 매니저 사용 이유는 BatchServiceBeansConfig.taskletTransactionManager 참고.
    @Bean
    public Step placePetAllowanceReflectStep(
        JobRepository jobRepository,
        @Qualifier("taskletTransactionManager") PlatformTransactionManager taskletTransactionManager,
        PlacePetAllowanceReflectTasklet placePetAllowanceReflectTasklet
    ) {
        return new StepBuilder(STEP_NAME, jobRepository)
            .tasklet(placePetAllowanceReflectTasklet, taskletTransactionManager)
            .build();
    }
}
