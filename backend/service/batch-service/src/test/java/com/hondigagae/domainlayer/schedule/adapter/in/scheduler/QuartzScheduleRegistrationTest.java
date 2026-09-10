package com.hondigagae.domainlayer.schedule.adapter.in.scheduler;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.global.properties.BatchScheduleProperties;
import java.time.DayOfWeek;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.quartz.JobKey;
import org.quartz.Scheduler;
import org.quartz.Trigger;
import org.quartz.TriggerKey;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.context.ConfigurationPropertiesAutoConfiguration;
import org.springframework.boot.autoconfigure.quartz.QuartzAutoConfiguration;
import org.springframework.boot.autoconfigure.quartz.SchedulerFactoryBeanCustomizer;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 조건만 통과해도 실제 스케줄러가 트리거를 집어 들지 못하면 아무 일도 일어나지 않는다.
 * 여기서는 {@code QuartzAutoConfiguration} 을 실제로 올려 JobDetail·Trigger 가 메모리 스토어에
 * 등록되는지와, cron 이 뜻하는 시각이 JVM 시간대가 아니라 설정 시간대로 해석되는지를 본다.
 *
 * <p><b>스케줄러는 시작하지 않는다.</b> 등록은 {@code SchedulerFactoryBean.afterPropertiesSet()} 에서
 * 끝나고, 시작해 버리면 테스트가 실제 cron 시각에 배치 잡을 띄우려 든다. 그런데
 * {@code spring.quartz.auto-startup=false} 만으로는 부족하다 — {@code QuartzScheduleConfig} 의
 * 커스터마이저가 그 프로퍼티를 true 로 되돌리기 때문이다. 그래서 <b>맨 뒤에 등록되는</b>
 * 커스터마이저({@link NoAutoStartupTestConfig})로 다시 눌러 둔다. 그 눌림이 실제로 먹었는지는
 * {@code staysInStandbyWithDaemonThreads} 가 지킨다.
 */
class QuartzScheduleRegistrationTest {

    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

    private static final String SCHEDULER_NAME = "batch-service-scheduler";

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
        .withConfiguration(AutoConfigurations.of(ConfigurationPropertiesAutoConfiguration.class, QuartzAutoConfiguration.class))
        .withUserConfiguration(BatchSchedulePropertiesTestConfig.class, QuartzScheduleConfig.class, NoAutoStartupTestConfig.class)
        .withPropertyValues(
            "batch.schedule.enabled=true",
            "spring.quartz.job-store-type=memory",
            "spring.quartz.auto-startup=false",
            "spring.quartz.properties.org.quartz.scheduler.instanceName=" + SCHEDULER_NAME,
            "spring.quartz.properties.org.quartz.threadPool.threadCount=1",
            "spring.quartz.properties.org.quartz.threadPool.makeThreadsDaemons=true",
            "spring.quartz.properties.org.quartz.scheduler.makeSchedulerThreadDaemon=true");

    @Test
    @DisplayName("메모리 스토어 스케줄러에 세 잡과 트리거가 등록된다")
    void registersBothJobsInMemoryStore() {
        contextRunner.run(context -> {
            Scheduler scheduler = context.getBean(Scheduler.class);
            assertThat(scheduler.checkExists(JobKey.jobKey("placeDataPipelineJob"))).isTrue();
            assertThat(scheduler.checkExists(JobKey.jobKey("congestionImportJob"))).isTrue();
            assertThat(scheduler.checkExists(JobKey.jobKey("olleCourseImportJob"))).isTrue();
            assertThat(scheduler.checkExists(TriggerKey.triggerKey("placeDataPipelineJobTrigger"))).isTrue();
            assertThat(scheduler.checkExists(TriggerKey.triggerKey("congestionImportJobTrigger"))).isTrue();
            assertThat(scheduler.checkExists(TriggerKey.triggerKey("olleCourseImportJobTrigger"))).isTrue();
        });
    }

    @Test
    @DisplayName("JobDataMap 이 실행할 잡 이름과 겹침 금지 목록을 실어 나른다")
    void carriesJobDataForLaunch() {
        contextRunner.run(context -> {
            var jobDataMap = context.getBean(Scheduler.class)
                .getJobDetail(JobKey.jobKey("congestionImportJob"))
                .getJobDataMap();
            assertThat(jobDataMap.getString(SpringBatchLaunchQuartzJob.JOB_NAME_KEY)).isEqualTo("congestionImportJob");
            // 혼잡도도 place 를 건드리는 잡 전부를 본다 — 사람이 자식 잡 하나만 단독으로 돌리는
            // 중에도 장소가 반쯤 들어온 상태라 UNMATCHED 가 대량으로 남는다.
            assertThat(jobDataMap.getString(SpringBatchLaunchQuartzJob.BLOCKED_BY_KEY))
                .isEqualTo("placeDataPipelineJob,placeImportJob,cultureFacilityImportJob,"
                    + "petRestaurantImportJob,placeMergeJob,placeImageBackfillJob,congestionImportJob");
        });
    }

    @Test
    @DisplayName("다음 발화는 JVM 시간대가 아니라 Asia/Seoul 기준 월요일 03:00 이다")
    void nextFireTimeFollowsConfiguredTimeZone() {
        contextRunner.run(context -> {
            Trigger trigger = context.getBean(Scheduler.class).getTrigger(TriggerKey.triggerKey("placeDataPipelineJobTrigger"));
            ZonedDateTime nextFire = trigger.getNextFireTime().toInstant().atZone(SEOUL);
            assertThat(nextFire.getDayOfWeek()).isEqualTo(DayOfWeek.MONDAY);
            assertThat(nextFire.getHour()).isEqualTo(3);
            assertThat(nextFire.getMinute()).isZero();
        });
    }

    @Test
    @DisplayName("스레드 1개 설정이 실제로 먹는다 — 파이프라인과 혼잡도가 동시에 뜨지 못한다")
    void appliesSingleThreadPool() {
        contextRunner.run(context -> {
            Scheduler scheduler = context.getBean(Scheduler.class);
            assertThat(scheduler.getSchedulerName()).isEqualTo("batch-service-scheduler");
            assertThat(scheduler.getMetaData().getThreadPoolSize()).isEqualTo(1);
        });
    }

    @Test
    @DisplayName("혼잡도는 매일 Asia/Seoul 06:00 에 발화한다")
    void congestionFiresDailyAtSix() {
        contextRunner.run(context -> {
            Trigger trigger = context.getBean(Scheduler.class).getTrigger(TriggerKey.triggerKey("congestionImportJobTrigger"));
            ZonedDateTime nextFire = trigger.getNextFireTime().toInstant().atZone(SEOUL);
            assertThat(nextFire.getHour()).isEqualTo(6);
            assertThat(nextFire.getMinute()).isZero();
        });
    }

    @Test
    @DisplayName("올레는 Asia/Seoul 월요일 05:00 에 발화하고 겹침 가드는 자기 자신만 본다")
    void olleFiresMondayAtFiveAndBlocksOnlyItself() {
        contextRunner.run(context -> {
            Scheduler scheduler = context.getBean(Scheduler.class);
            Trigger trigger = scheduler.getTrigger(TriggerKey.triggerKey("olleCourseImportJobTrigger"));
            ZonedDateTime nextFire = trigger.getNextFireTime().toInstant().atZone(SEOUL);
            assertThat(nextFire.getDayOfWeek()).isEqualTo(DayOfWeek.MONDAY);
            assertThat(nextFire.getHour()).isEqualTo(5);
            assertThat(nextFire.getMinute()).isZero();

            var jobDataMap = scheduler.getJobDetail(JobKey.jobKey("olleCourseImportJob")).getJobDataMap();
            assertThat(jobDataMap.getString(SpringBatchLaunchQuartzJob.JOB_NAME_KEY)).isEqualTo("olleCourseImportJob");
            assertThat(jobDataMap.getString(SpringBatchLaunchQuartzJob.BLOCKED_BY_KEY)).isEqualTo("olleCourseImportJob");
        });
    }

    @Test
    @DisplayName("스케줄러는 standby 로 남고, 그래도 이미 떠 있는 Quartz 스레드는 전부 데몬이다")
    void staysInStandbyWithDaemonThreads() {
        contextRunner.run(context -> {
            assertThat(context.getBean(Scheduler.class).isStarted()).isFalse();

            // 스레드풀과 스케줄러 스레드는 start() 가 아니라 스케줄러 생성 시점에 만들어진다.
            // 그래서 auto-startup 이 꺼져 있어도 non-daemon 이면 JVM 이 죽지 않는다 —
            // `--spring.main.web-application-type=none` 수동 실행이 잡을 끝내고도 남는 원인이었다.
            List<Thread> quartzThreads = Thread.getAllStackTraces().keySet().stream()
                .filter(thread -> thread.getName().startsWith(SCHEDULER_NAME))
                .toList();
            assertThat(quartzThreads).as("Quartz 스레드").isNotEmpty();
            assertThat(quartzThreads).allMatch(Thread::isDaemon, "데몬");
        });
    }

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(BatchScheduleProperties.class)
    static class BatchSchedulePropertiesTestConfig {
    }

    /**
     * {@code QuartzScheduleConfig} 뒤에 등록돼 auto-startup 을 다시 끈다. 커스터마이저는 등록 순서대로
     * 적용되므로(둘 다 기본 순서) 나중에 등록된 이쪽이 최종 값을 정한다.
     */
    @Configuration(proxyBeanMethods = false)
    static class NoAutoStartupTestConfig {

        @Bean
        SchedulerFactoryBeanCustomizer testNoAutoStartupCustomizer() {
            return factory -> factory.setAutoStartup(false);
        }
    }
}
