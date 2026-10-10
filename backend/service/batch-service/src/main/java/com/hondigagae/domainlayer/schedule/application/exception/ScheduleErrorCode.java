package com.hondigagae.domainlayer.schedule.application.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * batch-service는 웹 계층이 없어 HttpStatus는 두지 않는다.
 * 커스텀 코드는 스케줄 발화 실패 로그에서 원인을 식별하는 용도로 사용한다.
 */
@Getter
@RequiredArgsConstructor
public enum ScheduleErrorCode {

    JOB_NOT_FOUND("SCHEDULE_001", "스케줄할 배치 잡을 찾을 수 없습니다. (%s)"),
    LAUNCH_FAILED("SCHEDULE_002", "배치 잡 실행에 실패했습니다. (%s)"),
    DUPLICATE_JOB_NAME("SCHEDULE_003", "배치 잡 이름이 겹칩니다. (%s)");

    private final String code;
    private final String message;
}
