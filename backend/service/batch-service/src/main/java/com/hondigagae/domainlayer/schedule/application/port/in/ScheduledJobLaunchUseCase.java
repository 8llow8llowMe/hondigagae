package com.hondigagae.domainlayer.schedule.application.port.in;

import com.hondigagae.domainlayer.schedule.application.command.ScheduledLaunchCommand;
import com.hondigagae.domainlayer.schedule.application.model.ScheduledLaunchResult;

/**
 * 스케줄 발화 진입점.
 *
 * <p>웹 진입점이 아니라 Quartz 트리거가 부르므로 {@code *WebUseCase} 가 아닌
 * {@code *UseCase} 로 둔다 (coding-conventions §5 — 배치 진입점 규칙).
 */
public interface ScheduledJobLaunchUseCase {

    ScheduledLaunchResult launch(ScheduledLaunchCommand command);
}
