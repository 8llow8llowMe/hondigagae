package com.hondigagae.domainlayer.schedule.application.port.out;

import com.hondigagae.domainlayer.schedule.application.model.ScheduledLaunchResult.LaunchOutcome;
import java.time.Instant;

/** 스케줄 발화를 지표로 노출한다 (observability-guide.md "배치 지표"). */
public interface ScheduleMetricsPort {

    void recordFire(String jobName, LaunchOutcome outcome, Instant firedAt);
}
