package com.hondigagae.domainlayer.schedule.application.service.processor;

import com.hondigagae.domainlayer.schedule.application.port.out.BatchJobExecutionQueryPort;
import com.hondigagae.domainlayer.schedule.application.port.out.query.RunningJobExecutionQueryResult;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 겹치면 안 되는 잡이 아직 돌고 있는지 본다.
 *
 * <p>Quartz 의 {@code @DisallowConcurrentExecution} 은 같은 JobKey 의 중복 발화만 막는다.
 * 파이프라인과 혼잡도는 JobKey 가 달라 그 어노테이션이 닿지 않고, 무엇보다 <b>수동으로 띄운
 * 두 번째 JVM 의 실행</b>은 Quartz 가 아예 모른다. 겹침 판정의 유일한 공통 근거는 배치
 * 메타데이터라서 여기서 그것을 읽는다.
 *
 * <p><b>오래된 STARTED 는 무시한다.</b> JVM 이 OOM 이나 {@code docker kill} 로 죽으면
 * JobExecution 이 STARTED 인 채 메타 테이블에 영원히 남는다. 그것을 그대로 믿으면 스케줄이
 * 영원히 막혀 데이터가 무한정 낡는다 — 잘못 겹칠 위험보다 영원히 안 도는 쪽이 나쁘다.
 * 대신 조용히 넘기지 않고 ERROR 로 남겨 사람이 그 행을 정리하게 한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RunningJobGuardProcessor {

    private final BatchJobExecutionQueryPort batchJobExecutionQueryPort;

    /**
     * @return 이번 발화를 막는 잡 이름. 막는 것이 없으면 비어 있다
     */
    public Optional<String> findBlocking(List<String> jobNames, Instant now, Duration staleAfter) {
        if (jobNames == null || jobNames.isEmpty()) {
            return Optional.empty();
        }
        Instant staleBefore = now.minus(staleAfter);
        Optional<String> blocking = Optional.empty();
        for (RunningJobExecutionQueryResult running : batchJobExecutionQueryPort.findRunning(jobNames)) {
            if (running.startedAt().isAfter(staleBefore)) {
                // 첫 번째만 반환하되 나머지 방치 실행도 로그로 드러나게 순회는 끝까지 돈다
                blocking = blocking.or(() -> Optional.of(running.jobName()));
                continue;
            }
            log.error("abandoned running execution ignored jobName={} executionId={} startedAt={}",
                running.jobName(), running.executionId(), running.startedAt());
        }
        return blocking;
    }
}
