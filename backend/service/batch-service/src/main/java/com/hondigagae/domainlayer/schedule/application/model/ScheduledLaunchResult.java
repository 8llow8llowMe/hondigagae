package com.hondigagae.domainlayer.schedule.application.model;

/**
 * 스케줄 발화 한 번의 결과.
 *
 * @param jobName 발화 대상 잡 이름
 * @param runAt 잡에 넘긴 {@code runAt} JobParameter (설정 시간대 기준 초 단위 ISO 로컬 시각)
 * @param outcome 발화 처리 결과
 * @param executionId 실제로 띄웠을 때의 JobExecution id. 건너뛰거나 실패하면 null
 */
public record ScheduledLaunchResult(String jobName, String runAt, LaunchOutcome outcome, Long executionId) {

    /** 반복 사용되는 구분 값이라 enum 으로 둔다 (coding-conventions §8-3). 지표 태그로도 쓰인다. */
    public enum LaunchOutcome {

        /** 잡을 띄웠다. */
        LAUNCHED,

        /** 겹치면 안 되는 잡이 돌고 있어 이번 주기를 넘겼다. */
        SKIPPED_RUNNING,

        /** 띄우려다 실패했다. */
        FAILED
    }
}
