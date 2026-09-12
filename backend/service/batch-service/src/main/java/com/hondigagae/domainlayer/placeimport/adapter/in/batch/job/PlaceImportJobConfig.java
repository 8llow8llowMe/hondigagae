package com.hondigagae.domainlayer.placeimport.adapter.in.batch.job;

import com.hondigagae.domainlayer.placeimport.adapter.in.batch.tasklet.PlaceImageImportTasklet;
import com.hondigagae.domainlayer.placeimport.adapter.in.batch.tasklet.PlaceImportTasklet;
import com.hondigagae.domainlayer.placeimport.adapter.in.batch.tasklet.PlaceIntroImportTasklet;
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
 *
 * <p><b>스텝 순서와 쿼터 규칙</b> (#361, #478):
 * <ol>
 *   <li>{@code placeImportStep} — areaBasedList2 페이징. place 행을 만든다 (약 17콜)</li>
 *   <li>{@code placeIntroImportStep} — detailIntro2. 장소당 1콜이고 <b>실행당 상한</b>
 *       ({@code place-intro-import.max-calls-per-run}, 기본 300)까지만 부른다</li>
 *   <li>{@code placeImageImportStep} — detailImage2. 장소당 1콜이고 <b>실행당 상한</b>
 *       ({@code place-image-import.max-calls-per-run}, 기본 400)까지만 부른다</li>
 * </ol>
 * 뒤 두 스텝은 place 테이블의 TourAPI 행을 대상 목록으로 삼으므로 반드시 적재 뒤에 와야 한다.
 *
 * <p><b>두 상세 스텝이 모두 예산 안에서 돈다 (#478).</b> 개발계정은 일 1,000건인데 제주 전량은
 * 스텝당 약 964콜이라 둘 다 전량을 돌면 넘친다. 그래서 각자 실행당 상한 + 증분 대상 선정으로
 * 나눠 덮는다 — intro 는 "intro 없는 곳 먼저 → place_intro.synced_at 오래된 순 → id",
 * 이미지는 "한 번도 부르지 않은 곳 먼저 → place.image_synced_at 오래된 순 → id" 다.
 * 같은 날 최악 합은 {@code 17 + 300 + 400 + 276(수동 이미지 백필) + 1(올레) = 994} 다.
 *
 * <p><b>그래도 순서가 곧 예산 우선순위다.</b> 상한 합이 예산 안이라 평상시에는 둘 다 제 몫을
 * 받지만, 다른 잡이 예산을 예상보다 쓴 날에는 먼저 도는 쪽이 이긴다. intro 를 앞에 둔 이유는
 * 그쪽이 <b>아직 없는 데이터</b>라서다 — 이미지가 한도에 걸려 멈춰도 기존 place_image 행이
 * 그대로 남아 잃는 것은 "이번 주 갱신"뿐이지만, intro 가 못 돌면 그 장소의 영업 상태는 계속
 * "모름"이다. 이미지 스텝의 전량 커버는 3주 순환이다 ({@code ceil(964 / 400) = 3}).
 */
@Configuration
public class PlaceImportJobConfig {

    public static final String JOB_NAME = "placeImportJob";
    private static final String STEP_NAME = "placeImportStep";
    private static final String IMAGE_STEP_NAME = "placeImageImportStep";
    private static final String INTRO_STEP_NAME = "placeIntroImportStep";

    @Bean
    public Job placeImportJob(
        JobRepository jobRepository,
        Step placeImportStep,
        Step placeImageImportStep,
        Step placeIntroImportStep
    ) {
        return new JobBuilder(JOB_NAME, jobRepository)
            .start(placeImportStep)
            // 상세 소개가 이미지보다 먼저다 — 둘 다 장소 적재 뒤여야 하지만(place 의 TourAPI 행이
            // 대상 목록), 하루 예산은 하나뿐이라 순서가 곧 우선순위다. 상한 합(300+400)이 예산
            // 안이라 평상시엔 둘 다 돌지만, 모자란 날에는 앞이 이긴다. 클래스 javadoc 참고.
            .next(placeIntroImportStep)
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

    @Bean
    public Step placeIntroImportStep(
        JobRepository jobRepository,
        @Qualifier("taskletTransactionManager") PlatformTransactionManager taskletTransactionManager,
        PlaceIntroImportTasklet placeIntroImportTasklet
    ) {
        return new StepBuilder(INTRO_STEP_NAME, jobRepository)
            .tasklet(placeIntroImportTasklet, taskletTransactionManager)
            .build();
    }
}
