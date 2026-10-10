package com.hondigagae;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.schedule.adapter.in.scheduler.SpringBatchLaunchQuartzJob;
import org.junit.jupiter.api.Test;
import org.quartz.JobDetail;
import org.quartz.JobKey;
import org.quartz.Scheduler;
import org.quartz.Trigger;
import org.quartz.TriggerKey;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * 스케줄이 켜진 상태의 전체 컨텍스트 게이트.
 *
 * <p>{@code QuartzScheduleConfigConditionTest} 는 부분 컨텍스트로 조건만 본다. 여기서는 배치 잡 8개·
 * {@code PlatformTransactionManager} 두 개(@Primary 해소)·Quartz 자동 구성이 <b>한 컨텍스트에서</b> 함께
 * 뜨고, JobDetail 3개와 트리거 3개가 실제 {@code Scheduler} 에 등록되는지 본다.
 *
 * <p><b>여기서는 스케줄러가 실제로 시작된다.</b> {@code spring.quartz.auto-startup=false} 를 줘도
 * {@code QuartzScheduleConfig} 의 커스터마이저가 켠다 — 그것이 운영에서 원하는 동작이라 함께 고정한다.
 * 대신 <b>발화는 절대 일어나면 안 되므로</b> cron 의 연도를 오지 않을 해로 못박는다. 실제
 * cron(월 03:00 / 월 05:00 / 매일 06:00) 해석은 {@code QuartzScheduleRegistrationTest} 가 본다.
 */
@SpringBootTest(properties = {
    "batch.schedule.enabled=true",
    "spring.quartz.auto-startup=false",
    "batch.schedule.place-pipeline-cron=0 0 3 1 1 ? 2099",
    "batch.schedule.olle-cron=0 0 5 1 1 ? 2099",
    "batch.schedule.congestion-cron=0 0 6 1 1 ? 2099"
})
@ActiveProfiles("test")
class BatchScheduleContextTests {

    @Autowired
    private Scheduler scheduler;

    @Test
    void registersPipelineAndCongestionSchedules() throws Exception {
        // 커스터마이저가 auto-startup 프로퍼티를 이긴다 — 조건이 참인 컨텍스트에서만 스케줄러가 돈다.
        assertThat(scheduler.isStarted()).isTrue();

        for (String jobName : new String[]{"placeDataPipelineJob", "congestionImportJob", "olleCourseImportJob"}) {
            JobDetail detail = scheduler.getJobDetail(JobKey.jobKey(jobName));
            assertThat(detail).as(jobName + " JobDetail").isNotNull();
            assertThat(detail.getJobClass()).isEqualTo(SpringBatchLaunchQuartzJob.class);
            assertThat(detail.getJobDataMap().getString(SpringBatchLaunchQuartzJob.JOB_NAME_KEY)).isEqualTo(jobName);

            Trigger trigger = scheduler.getTrigger(TriggerKey.triggerKey(jobName + "Trigger"));
            assertThat(trigger).as(jobName + " Trigger").isNotNull();
            assertThat(trigger.getJobKey()).isEqualTo(detail.getKey());
            // 스케줄러가 돌고 있어도 이 컨텍스트에서 발화한 적은 없어야 한다.
            assertThat(trigger.getPreviousFireTime()).as(jobName + " 발화 이력").isNull();
        }
    }
}
