package com.hondigagae.domainlayer.placeimport.adapter.in.batch.job;

import com.hondigagae.domainlayer.placeimport.adapter.in.batch.listener.PipelineExitStatusListener;
import org.springframework.batch.core.Job;
import org.springframework.batch.core.Step;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.launch.JobLauncher;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 장소 적재 5단계를 하나로 잇는 파이프라인 잡.
 *
 * <p>지금까지 순서는 사람이 지켰다 — 문서에 적힌 다섯 줄을 차례로 치는 방식이라 한 줄을
 * 빠뜨리면 중복이 목록에 남거나(병합 누락) 이미지가 비었다(백필 누락). 순서를 코드로 옮긴다.
 * <pre>
 * placeImportJob → cultureFacilityImportJob → petRestaurantImportJob → placeMergeJob → placeImageBackfillJob
 * </pre>
 *
 * <p>실행 방법:
 * <pre>
 * java -jar batch.jar --spring.batch.job.enabled=true --spring.batch.job.name=placeDataPipelineJob areaCode=39 runAt=&lt;ISO 시각&gt;
 * </pre>
 * JobParameters — 자식 잡들이 쓰는 파라미터를 부모에 그대로 준다:
 * <ul>
 *   <li>{@code areaCode} — 관광 지역코드 (기본 39=제주). placeImport·placeMerge·placeImageBackfill 이 읽는다</li>
 *   <li>{@code sido} — 시도 명칭 (기본 제주특별자치도). cultureFacilityImport 가 읽는다</li>
 *   <li>{@code region} — 원천의 짧은 지역 표기 (기본 제주). petRestaurantImport 가 읽는다</li>
 *   <li>{@code contentTypeIds} — 콤마 구분 contentTypeId 목록 (생략 시 기본 대상 7종)</li>
 *   <li>{@code runAt} — 실행마다 새로 주는 식별 파라미터(ISO 시각). <b>재시도도 새 값으로 한다.</b>
 *       같은 값으로 다시 돌리면 {@code JobRestartException} 으로 시작 전에 거부된다(아래 restart 금지)</li>
 * </ul>
 * 자식 잡에 파라미터를 따로 넘길 필요는 없다. {@code JobStep} 의 기본 추출기가
 * {@code DefaultJobParametersExtractor(useAllParentParameters=true)} 라 부모의 파라미터가
 * 그대로 자식 JobParameters 가 된다.
 *
 * <p><b>자식이 실패(FAILED)해도 뒤 단계는 계속 간다</b> ({@code .on("*")} 로 exit status 를 가리지 않고 잇는다.
 * 단, 자식이 STOPPED 로 끝나면 Spring Batch 가 파이프라인 자체를 중단하므로 그 경우는 예외다).
 * 다섯 잡이 모두 멱등이고 실패해도 기존 데이터를 지우지 않으므로, 식약처 원천 하나가 404 라고 해서
 * 병합·이미지 백필까지 멈추면 지난 주 데이터마저 손대지 않은 채로 남는다. <b>지난 주 데이터로 판정하는
 * 편이 아예 멈추는 것보다 낫다</b> — 실패한 원천은 다음 실행에서 따라잡는다.
 *
 * <p><b>부모 FAILED 규칙</b>: 계속 가는 대신 실패를 숨기지 않는다. 자식이 하나라도 실패하면
 * {@link PipelineExitStatusListener} 가 부모 JobExecution 을 FAILED 로 내리고 어느 스텝이
 * 실패했는지 exit description 에 적는다.
 *
 * <p><b>restart 를 막는다</b> ({@code preventRestart()}). 부모가 FAILED 로 끝난 뒤 같은 {@code runAt} 으로 다시
 * 돌리면 Spring Batch 는 그것을 <i>restart</i> 로 보고 이미 COMPLETED 인 스텝을 건너뛴다 — 실패한 원천만
 * 다시 적재되고 병합·백필은 돌지 않는데, 건너뛴 스텝은 이번 실행의 StepExecution 에 없어 리스너도 잡지
 * 못해 부모가 COMPLETED 로 끝난다. 재시도는 새 {@code runAt} 으로 전체를 다시 돈다(모두 멱등이라 안전하다).
 *
 * <p><b>{@code congestionImportJob} 은 이 파이프라인에 넣지 않는다.</b> 장소 적재는 주 1회이고
 * 혼잡도는 30일 rolling 원천이라 일 1회다. 주기가 다른 잡을 한 잡에 묶으면 둘 중 하나를 필요 이상으로
 * 자주 또는 드물게 돌리게 된다. 혼잡도는 파이프라인 뒤에 따로 부른다.
 */
@Configuration
public class PlaceDataPipelineJobConfig {

    public static final String JOB_NAME = "placeDataPipelineJob";

    private static final String PLACE_IMPORT_STEP_NAME = "placeImportJobStep";
    private static final String CULTURE_FACILITY_IMPORT_STEP_NAME = "cultureFacilityImportJobStep";
    private static final String PET_RESTAURANT_IMPORT_STEP_NAME = "petRestaurantImportJobStep";
    private static final String PLACE_MERGE_STEP_NAME = "placeMergeJobStep";
    private static final String PLACE_IMAGE_BACKFILL_STEP_NAME = "placeImageBackfillJobStep";

    /** FAILED 를 포함해 어떤 exit status 든 다음 단계로 잇는 전이 패턴(STOPPED 는 Batch 가 먼저 중단한다). */
    private static final String ANY_EXIT_STATUS = "*";

    @Bean
    public Job placeDataPipelineJob(
        JobRepository jobRepository,
        PipelineRegionParametersValidator pipelineRegionParametersValidator,
        PipelineExitStatusListener pipelineExitStatusListener,
        Step placeImportJobStep,
        Step cultureFacilityImportJobStep,
        Step petRestaurantImportJobStep,
        Step placeMergeJobStep,
        Step placeImageBackfillJobStep
    ) {
        return new JobBuilder(JOB_NAME, jobRepository)
            // 같은 runAt 재실행은 restart 가 되어 COMPLETED 스텝을 건너뛴다 — 새 runAt 만 허용한다 (클래스 javadoc)
            .preventRestart()
            .validator(pipelineRegionParametersValidator)
            .listener(pipelineExitStatusListener)
            .start(placeImportJobStep)
            .on(ANY_EXIT_STATUS).to(cultureFacilityImportJobStep)
            .on(ANY_EXIT_STATUS).to(petRestaurantImportJobStep)
            .on(ANY_EXIT_STATUS).to(placeMergeJobStep)
            .on(ANY_EXIT_STATUS).to(placeImageBackfillJobStep)
            .on(ANY_EXIT_STATUS).end()
            .end()
            .build();
    }

    // 자식 Job 빈은 타입이 모두 Job 이라 파라미터 이름만으로는 갈리지 않는다 — 빈 이름을 @Qualifier 로 못박는다.
    @Bean
    public Step placeImportJobStep(JobRepository jobRepository, JobLauncher jobLauncher, @Qualifier("placeImportJob") Job placeImportJob) {
        return new StepBuilder(PLACE_IMPORT_STEP_NAME, jobRepository)
            .job(placeImportJob)
            .launcher(jobLauncher)
            .build();
    }

    @Bean
    public Step cultureFacilityImportJobStep(
        JobRepository jobRepository,
        JobLauncher jobLauncher,
        @Qualifier("cultureFacilityImportJob") Job cultureFacilityImportJob
    ) {
        return new StepBuilder(CULTURE_FACILITY_IMPORT_STEP_NAME, jobRepository)
            .job(cultureFacilityImportJob)
            .launcher(jobLauncher)
            .build();
    }

    @Bean
    public Step petRestaurantImportJobStep(
        JobRepository jobRepository,
        JobLauncher jobLauncher,
        @Qualifier("petRestaurantImportJob") Job petRestaurantImportJob
    ) {
        return new StepBuilder(PET_RESTAURANT_IMPORT_STEP_NAME, jobRepository)
            .job(petRestaurantImportJob)
            .launcher(jobLauncher)
            .build();
    }

    @Bean
    public Step placeMergeJobStep(JobRepository jobRepository, JobLauncher jobLauncher, @Qualifier("placeMergeJob") Job placeMergeJob) {
        return new StepBuilder(PLACE_MERGE_STEP_NAME, jobRepository)
            .job(placeMergeJob)
            .launcher(jobLauncher)
            .build();
    }

    @Bean
    public Step placeImageBackfillJobStep(
        JobRepository jobRepository,
        JobLauncher jobLauncher,
        @Qualifier("placeImageBackfillJob") Job placeImageBackfillJob
    ) {
        return new StepBuilder(PLACE_IMAGE_BACKFILL_STEP_NAME, jobRepository)
            .job(placeImageBackfillJob)
            .launcher(jobLauncher)
            .build();
    }
}
