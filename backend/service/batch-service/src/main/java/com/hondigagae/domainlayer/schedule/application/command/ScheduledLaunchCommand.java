package com.hondigagae.domainlayer.schedule.application.command;

import java.time.Instant;
import java.util.List;

/**
 * 스케줄 발화 한 번의 요청.
 *
 * @param jobName 실행할 배치 잡 이름 ({@code JobBuilder} 에 준 이름과 같아야 한다)
 * @param mustNotBeRunning 이 중 하나라도 돌고 있으면 이번 발화를 건너뛴다.
 *     자기 자신도 포함한다 — 지난 주 실행이 아직 안 끝났는데 또 시작하면 같은 행을 두 JVM 흐름이 upsert 한다
 * @param firedAt Quartz 가 이 발화를 잡은 시각. {@code runAt} JobParameter 의 원천이다
 */
public record ScheduledLaunchCommand(String jobName, List<String> mustNotBeRunning, Instant firedAt) {
}
