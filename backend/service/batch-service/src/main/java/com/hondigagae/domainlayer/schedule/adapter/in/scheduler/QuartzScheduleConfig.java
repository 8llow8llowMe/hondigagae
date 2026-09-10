package com.hondigagae.domainlayer.schedule.adapter.in.scheduler;

import com.hondigagae.global.properties.BatchScheduleProperties;
import java.util.TimeZone;
import org.quartz.CronScheduleBuilder;
import org.quartz.JobBuilder;
import org.quartz.JobDetail;
import org.quartz.Trigger;
import org.quartz.TriggerBuilder;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.quartz.SchedulerFactoryBeanCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Conditional;
import org.springframework.context.annotation.Configuration;

/**
 * 주기 실행 트리거 등록 (#378).
 *
 * <p><b>왜 프로세스 안 스케줄러인가.</b> 배포 호스트 cron 은 컨테이너 밖에 산다 — 어느 호스트의
 * crontab 에 무엇이 걸려 있는지가 저장소에 남지 않고, 컨테이너를 옮기면 조용히 사라진다.
 * 게다가 cron 이 부르는 것은 {@code docker exec java -jar ...} 라 컨테이너 안에 두 번째 JVM 이
 * 뜬다(메모리 상한 공유·Eureka 중복 등록). 상시 기동 컨테이너({@code restart: unless-stopped})가
 * 이미 있으니 그 프로세스가 스스로 시각을 지키는 편이 배포 단위와 스케줄 단위를 일치시킨다.
 *
 * <p><b>왜 메모리 잡 스토어인가.</b> 인스턴스가 하나이고 트리거 정의가 전부 이 코드에 있어
 * 영속할 상태가 없다. JDBC 스토어를 쓰면 tour 스키마에 QRTZ_* 테이블 열두 개가 더해지는데,
 * 그것이 지켜주는 것(다중 인스턴스 배타 실행, 재기동 후 misfire 복원)은 지금 필요 없다.
 * 재기동 중 놓친 발화는 아래 misfire 정책이 아니라 <b>다음 주기</b>가 따라잡는다.
 *
 * <p><b>왜 FireAndProceed 인가.</b> 컨테이너가 발화 시각에 재시작 중이었거나 스레드가 물려 있어
 * 늦게 깨어나면, Quartz 기본 정책은 놓친 발화를 통째로 버린다. 주 1회 잡을 한 번 건너뛰면
 * 데이터가 <b>한 주 더</b> 낡는다. 늦게라도 한 번 돌고 다음 주기로 돌아가는 쪽이 낫다.
 * 여러 번 놓쳤어도 한 번만 몰아 실행한다.
 *
 * <p><b>왜 시간대를 명시하는가.</b> {@code -Duser.timezone} 은 Dockerfile 이 {@code $TIME_ZONE}
 * 으로 넣는 값이라 배포 환경 변수 하나로 03:00 이 다른 나라 새벽이 될 수 있다. cron 이 뜻하는
 * 시각은 배포 설정이 아니라 이 잡의 성질(한국 관광 데이터 원천의 갱신 주기)에서 나오므로
 * 트리거가 직접 시간대를 못박는다.
 *
 * <p><b>수동 실행 JVM 에서는 켜지지 않는다.</b> {@code --spring.batch.job.enabled=true} 로 띄운
 * 두 번째 JVM 은 잡 하나를 돌리고 끝나야 하는데, 거기에 스케줄 트리거까지 붙으면 그 짧은 수명
 * 동안 또 다른 잡을 띄울 수 있다. {@link ScheduleEnabledCondition} 이 그 조합을 배제한다 —
 * 조건은 SpEL 이 아니라 {@code @ConditionalOnProperty} 조합이다(이유는 그 클래스 javadoc).
 */
@Configuration
@Conditional(ScheduleEnabledCondition.class)
public class QuartzScheduleConfig {

    private static final String PLACE_PIPELINE_JOB_NAME = "placeDataPipelineJob";
    private static final String CONGESTION_JOB_NAME = "congestionImportJob";
    private static final String OLLE_JOB_NAME = "olleCourseImportJob";

    /**
     * 두 스케줄이 공유하는 겹침 금지 목록 — place 마스터를 건드리는 잡 전부다.
     *
     * <p>파이프라인 쪽은 자명하다. 자기 자신, 자식 잡 다섯, 그리고 같은 place 행을 이름으로 잇는
     * 혼잡도 잡 중 하나라도 돌고 있으면 이번 주기를 넘긴다.
     *
     * <p><b>혼잡도 쪽도 같은 목록이어야 한다.</b> 혼잡도는 place 를 읽어 이름을 잇는데, 장소가
     * 반쯤 들어온 상태를 보면 UNMATCHED 를 대량으로 남긴다. 그 "반쯤" 은 파이프라인이 돌 때만
     * 생기는 것이 아니다 — 사람이 {@code docker exec} 로 자식 잡 하나만(예:
     * {@code petRestaurantImportJob}) 돌리는 중에도 똑같이 생긴다. 파이프라인과 첫 단계만 보던
     * 좁은 목록은 그 단독 수동 실행을 놓쳤다.
     */
    private static final String PLACE_JOBS_BLOCKED_BY =
        "placeDataPipelineJob,placeImportJob,cultureFacilityImportJob,petRestaurantImportJob,placeMergeJob,placeImageBackfillJob,congestionImportJob";

    @Bean
    public JobDetail placeDataPipelineJobDetail() {
        return newJobDetail(PLACE_PIPELINE_JOB_NAME, PLACE_JOBS_BLOCKED_BY);
    }

    @Bean
    public Trigger placeDataPipelineTrigger(
        BatchScheduleProperties batchScheduleProperties,
        @Qualifier("placeDataPipelineJobDetail") JobDetail placeDataPipelineJobDetail
    ) {
        return newCronTrigger(placeDataPipelineJobDetail, batchScheduleProperties.placePipelineCron(), batchScheduleProperties.timeZone());
    }

    @Bean
    public JobDetail congestionImportJobDetail() {
        return newJobDetail(CONGESTION_JOB_NAME, PLACE_JOBS_BLOCKED_BY);
    }

    @Bean
    public Trigger congestionImportTrigger(
        BatchScheduleProperties batchScheduleProperties,
        @Qualifier("congestionImportJobDetail") JobDetail congestionImportJobDetail
    ) {
        return newCronTrigger(congestionImportJobDetail, batchScheduleProperties.congestionCron(), batchScheduleProperties.timeZone());
    }

    /**
     * 올레는 place 를 건드리지 않는다. 겹침 가드는 자기 자신만 본다.
     *
     * <p>파이프라인과 시각이 겹쳐도 Quartz 스레드가 1개라 자연히 뒤에 선다. 장소 반쯤
     * 들어온 상태가 올레 적재를 더럽히지 않으므로 place 잡 목록에 넣지 않는다.
     */
    @Bean
    public JobDetail olleCourseImportJobDetail() {
        return newJobDetail(OLLE_JOB_NAME, OLLE_JOB_NAME);
    }

    @Bean
    public Trigger olleCourseImportTrigger(
        BatchScheduleProperties batchScheduleProperties,
        @Qualifier("olleCourseImportJobDetail") JobDetail olleCourseImportJobDetail
    ) {
        return newCronTrigger(olleCourseImportJobDetail, batchScheduleProperties.olleCron(), batchScheduleProperties.timeZone());
    }

    /**
     * 스케줄러 시작 스위치. {@code application.yml} 의 {@code spring.quartz.auto-startup} 은
     * <b>고정 false</b> 이고, 이 빈이 조건을 통과한 컨텍스트에서만 true 로 되돌린다.
     *
     * <p>프로퍼티에 {@code ${batch.schedule.enabled:false}} 를 그대로 꽂아 두면 값이 빈 문자열일 때
     * 불리언 바인딩이 깨진다(원인은 {@link ScheduleEnabledCondition} javadoc). 시작 여부를 조건과
     * 같은 판정에 묶으면 그 경로가 통째로 사라진다 — 조건이 참이 아니면 트리거도 없고 스케줄러도
     * standby 로 남으므로, 수동 CLI JVM 은 등록도 시작도 하지 않는다.
     */
    @Bean
    public SchedulerFactoryBeanCustomizer scheduleAutoStartupCustomizer() {
        return factory -> factory.setAutoStartup(true);
    }

    // storeDurably — 트리거가 아직 붙지 않은 상태로도 스케줄러에 남아야 등록 순서에 걸리지 않는다.
    private JobDetail newJobDetail(String jobName, String blockedBy) {
        return JobBuilder.newJob(SpringBatchLaunchQuartzJob.class)
            .withIdentity(jobName)
            .storeDurably()
            .usingJobData(SpringBatchLaunchQuartzJob.JOB_NAME_KEY, jobName)
            .usingJobData(SpringBatchLaunchQuartzJob.BLOCKED_BY_KEY, blockedBy)
            .build();
    }

    private Trigger newCronTrigger(JobDetail jobDetail, String cron, String timeZone) {
        return TriggerBuilder.newTrigger()
            .forJob(jobDetail)
            .withIdentity(jobDetail.getKey().getName() + "Trigger")
            .withSchedule(CronScheduleBuilder.cronSchedule(cron)
                .inTimeZone(TimeZone.getTimeZone(timeZone))
                .withMisfireHandlingInstructionFireAndProceed())
            .build();
    }
}
