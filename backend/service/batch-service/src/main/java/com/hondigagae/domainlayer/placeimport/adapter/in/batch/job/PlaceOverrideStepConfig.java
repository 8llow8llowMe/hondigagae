package com.hondigagae.domainlayer.placeimport.adapter.in.batch.job;

import com.hondigagae.domainlayer.placeimport.adapter.in.batch.tasklet.PlaceOverrideTasklet;
import org.springframework.batch.core.Step;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;

/**
 * 장소 보정 스텝 (#1434). 잡이 아니라 스텝 하나만 정의한다 — 보정 칸을 다시 쓰는 잡 넷이 같은 정의를 <b>마지막 단계</b>로 붙인다.
 * <pre>
 * cultureFacilityImportJob : cultureFacilityImportStep                                → <b>placeOverrideStep</b>   (문화정보원 행의 실내외 · 동반 칸을 덮은 뒤)
 * petRestaurantImportJob   : petRestaurantImportStep                                  → <b>placeOverrideStep</b>   (식약처 행의 동반 칸을 덮은 뒤)
 * placeMergeJob            : placeMergeStep    → placePetAllowanceReflectStep → <b>placeOverrideStep</b>   (재계산 뒤)
 * petTourImportJob         : petTourImportStep → placePetAllowanceReflectStep → <b>placeOverrideStep</b>   (재계산 뒤)
 * </pre>
 * 보정이 살아남으려면 그 칸의 <b>마지막 쓰기</b>여야 한다. 문화정보원 · 식약처 적재는 자기 행의 칸을 매번 원천 값으로 덮고, 병합은 관광 API
 * 행의 빈 실내외를 흡수 행 값으로 채운다. 그래서 그런 스텝을 가진 잡마다 끝에 붙인다 — 잡 하나만 손으로 돌려도 보정이 다시 얹힌다.
 * 재계산 스텝은 동반 구분을 보정한 행을 대상에서 빼므로(<b>보정이 이긴다</b>) 그 칸을 되돌리지 않는다 — 두 스텝이 서로 덮는 왕복은 없다.
 *
 * <p>{@code placeImportJob}(TourAPI 목록 적재)에는 붙이지 않는다. 그 upsert 는 보정 칸을 UPDATE 절에서 쓰지 않는다
 * ({@code JdbcPlaceBulkAdapterSqlTest}). 파이프라인에서는 네 번 돌지만 파일 읽기 한 번 + 대상 조회 한 번 + 바뀐 행만 갱신이라 싸다.
 */
@Configuration
public class PlaceOverrideStepConfig {

    public static final String STEP_NAME = "placeOverrideStep";

    // 무자원 매니저 사용 이유는 BatchServiceBeansConfig.taskletTransactionManager 참고.
    @Bean
    public Step placeOverrideStep(
        JobRepository jobRepository,
        @Qualifier("taskletTransactionManager") PlatformTransactionManager taskletTransactionManager,
        PlaceOverrideTasklet placeOverrideTasklet
    ) {
        return new StepBuilder(STEP_NAME, jobRepository)
            .tasklet(placeOverrideTasklet, taskletTransactionManager)
            .build();
    }
}
