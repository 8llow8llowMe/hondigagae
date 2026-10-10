package com.hondigagae.domainlayer.schedule.application.port.out.query;

import java.time.Instant;

/**
 * 아직 끝나지 않은(STARTED/STARTING) 배치 실행 한 건.
 *
 * @param jobName 실행 중인 잡 이름
 * @param executionId JobExecution id. 방치된 실행을 사람이 찾아 지울 때 필요하다
 * @param startedAt 시작 시각. 값이 없는 실행은 생성 시각으로 채운다
 */
public record RunningJobExecutionQueryResult(String jobName, long executionId, Instant startedAt) {
}
