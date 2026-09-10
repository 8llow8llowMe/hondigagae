package com.hondigagae.domainlayer.schedule.application.service;

import com.hondigagae.domainlayer.schedule.application.command.ScheduledLaunchCommand;
import com.hondigagae.domainlayer.schedule.application.exception.ScheduleException;
import com.hondigagae.domainlayer.schedule.application.model.ScheduledLaunchResult;
import com.hondigagae.domainlayer.schedule.application.model.ScheduledLaunchResult.LaunchOutcome;
import com.hondigagae.domainlayer.schedule.application.port.in.ScheduledJobLaunchUseCase;
import com.hondigagae.domainlayer.schedule.application.port.out.BatchJobLaunchPort;
import com.hondigagae.domainlayer.schedule.application.port.out.ScheduleMetricsPort;
import com.hondigagae.domainlayer.schedule.application.service.processor.RunningJobGuardProcessor;
import com.hondigagae.global.properties.BatchScheduleProperties;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 스케줄 발화를 받아 배치 잡을 띄운다.
 *
 * <p><b>트랜잭션을 걸지 않는다.</b> 이 파사드가 직접 건드리는 DB 는 없고,
 * {@code JobLauncher} 는 배치 메타데이터 트랜잭션을 JobRepository 안에서 스스로 관리한다.
 * 게다가 동기 launcher 라면 잡이 끝날 때까지(수십 분) 반환하지 않으므로, 여기에 트랜잭션을
 * 걸면 그 시간 내내 DB 커넥션을 붙들게 된다 (architecture-guide.md §3 예외 규정).
 *
 * <p><b>{@code runAt} 을 여기서 만든다.</b> 배치 잡들은 재실행 구분용 증분 파라미터로
 * {@code runAt} 을 받는다. Quartz 발화 시각을 설정 시간대(기본 Asia/Seoul)로 옮겨
 * 초 단위로 자른 {@code 2026-09-14T03:00:00} 꼴을 쓴다 — 사람이 로그에서 바로 읽을 수 있고,
 * 수동 실행이 손으로 넣는 값과 자릿수가 같다.
 *
 * <p><b>같은 {@code runAt} 으로 두 번 발화하는 경우.</b> 구조상 오지 않는다 — misfire 정책이
 * {@code FireAndProceed} 라 놓친 발화는 <b>발화 시각을 지금으로 갱신해</b> 한 번만 돈다.
 * 그래도 온다면(트리거를 손으로 다시 쏘는 등) Spring Batch 가 같은 JobInstance 로 보고 재시작을
 * 거부하므로({@code JobRestartException} / {@code JobInstanceAlreadyCompleteException}) 조용히
 * 두 번 도는 대신 {@code LAUNCH_FAILED} 로 바뀌어 FAILED 지표에 드러난다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ScheduledJobLaunchFacade implements ScheduledJobLaunchUseCase {

    /**
     * {@code LocalDateTime.toString()} 은 초가 0 이면 초를 빼고 {@code 2026-09-14T03:00} 을 낸다.
     * 정각 발화가 대부분이라 그대로 두면 수동 실행 예시와 자릿수가 달라지므로 고정 패턴을 쓴다.
     */
    private static final DateTimeFormatter RUN_AT_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    private static final String RUN_AT_PARAMETER = "runAt";
    private static final String TRIGGER_PARAMETER = "trigger";
    private static final String TRIGGER_VALUE = "quartz";

    private final BatchScheduleProperties batchScheduleProperties;
    private final RunningJobGuardProcessor runningJobGuardProcessor;
    private final BatchJobLaunchPort batchJobLaunchPort;
    private final ScheduleMetricsPort scheduleMetricsPort;

    @Override
    public ScheduledLaunchResult launch(ScheduledLaunchCommand command) {
        String jobName = command.jobName();
        Instant firedAt = command.firedAt();
        String runAt = toRunAt(firedAt);

        Optional<String> blocking = runningJobGuardProcessor.findBlocking(
            command.mustNotBeRunning(), firedAt, batchScheduleProperties.staleRunningAfter());
        if (blocking.isPresent()) {
            log.warn("schedule fire skipped jobName={} runAt={} blockedBy={}", jobName, runAt, blocking.get());
            scheduleMetricsPort.recordFire(jobName, LaunchOutcome.SKIPPED_RUNNING, firedAt);
            return new ScheduledLaunchResult(jobName, runAt, LaunchOutcome.SKIPPED_RUNNING, null);
        }

        try {
            long executionId = batchJobLaunchPort.launch(
                jobName, Map.of(RUN_AT_PARAMETER, runAt), Map.of(TRIGGER_PARAMETER, TRIGGER_VALUE));
            log.info("schedule fire launched jobName={} runAt={} executionId={}", jobName, runAt, executionId);
            scheduleMetricsPort.recordFire(jobName, LaunchOutcome.LAUNCHED, firedAt);
            return new ScheduledLaunchResult(jobName, runAt, LaunchOutcome.LAUNCHED, executionId);
        } catch (ScheduleException exception) {
            log.error("schedule fire failed jobName={} runAt={} errorCode={}",
                jobName, runAt, exception.getErrorCode().getCode(), exception);
            scheduleMetricsPort.recordFire(jobName, LaunchOutcome.FAILED, firedAt);
            // 삼키지 않는다. Quartz 쪽에서 JobExecutionException 으로 바꿔 트리거 이력에 남긴다.
            throw exception;
        }
    }

    private String toRunAt(Instant firedAt) {
        return RUN_AT_FORMAT.format(LocalDateTime.ofInstant(firedAt, ZoneId.of(batchScheduleProperties.timeZone())));
    }
}
