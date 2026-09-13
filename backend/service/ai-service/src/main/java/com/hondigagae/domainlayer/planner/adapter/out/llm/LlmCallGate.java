package com.hondigagae.domainlayer.planner.adapter.out.llm;

import com.hondigagae.domainlayer.planner.application.exception.AiPlanErrorCode;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanException;
import com.hondigagae.global.properties.AiLlmProperties;
import java.time.Duration;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 모델 호출의 차례를 하나만 내준다 (#508).
 *
 * <p><b>기다림을 HTTP 호출 안이 아니라 이 앞에 둔다.</b> Ollama 는
 * {@code OLLAMA_NUM_PARALLEL=1} 이라 한 번에 하나만 추론하는데, 이 게이트가 없으면 두 번째
 * 호출이 <b>이미 전송된 채로</b> 서버 안에서 차례를 기다린다. 그러면 read timeout 시계가
 * 남을 기다리는 동안에도 돌아 <b>남을 기다린 시간이 내 타임아웃을 깎는다.</b>
 *
 * <p>2026-09-13 dev 대조 실험이 그 결과다 — 단독 제출은 66초에 COMPLETED 인데, 동시 2건은
 * <b>둘 다</b> 123.5초에 AIPLAN_020 으로 죽었다(= {@code AI_LLM_TIMEOUT_MS} 120초). 뒤에
 * 누른 사람만 잃는 것이 아니라 <b>먼저 누른 사람까지</b> 잃는다.
 *
 * <p>여기서 차례를 받은 뒤에 호출을 시작하므로 read timeout 은 <b>내 차례가 온 시점부터</b>
 * 잰다. 그래서 AIPLAN_020(모델이 제한 시간을 넘김)은 이제 정말로 "내 요청이 무겁다" 는
 * 뜻이고, 붐벼서 차례를 못 받은 것은 {@link AiPlanErrorCode#LLM_BUSY} 로 갈라진다 —
 * 사용자가 할 일이 다르다(조건을 줄인다 vs 잠시 뒤 다시 누른다).
 *
 * <p><b>왜 어댑터 계층인가.</b> 막는 대상이 "GPU 1대를 공유하는 provider" 라는 인프라 사실이다.
 * application 계층은 {@code AiLlmPort} 뒤에서 이 제약을 몰라야 한다.
 *
 * <p><b>공정(FIFO) 세마포어를 쓴다.</b> 불공정이면 늦게 온 요청이 새치기해 먼저 기다리던
 * 요청이 계속 밀릴 수 있다 — 대기 시간이 예측 가능해야 아래의 타임아웃 계산이 성립한다.
 *
 * <p>일정 생성 워커는 {@code aiPlanTaskExecutor} 가 이미 1스레드라 여기서 서로 부딪히지
 * 않는다. 이 게이트가 실제로 막는 것은 <b>동기 준비물 생성</b>(요청 스레드에서 바로 호출)과
 * 일정 생성이 겹치는 경우이고, 나머지는 풀 설정이 바뀌어도 계약이 유지되게 하는 방어선이다.
 *
 * <p><b>전제: ai-service 인스턴스가 하나다.</b> 세마포어는 프로세스 안에서만 공정하므로,
 * 인스턴스를 둘로 늘리면 같은 Ollama 앞에서 다시 두 호출이 겹친다 — #508 의 원상황 그대로다.
 * 스케일아웃하려면 이 게이트를 프로세스 밖(Redis 분산 락 등)으로 옮기거나, 그 전에
 * {@code OLLAMA_NUM_PARALLEL} 을 인스턴스 수만큼 올리고 재측정해야 한다.
 */
@Slf4j
@Component
public class LlmCallGate {

    /** 이 시간을 넘겨 기다린 차례는 로그로 남긴다. 정상 호출이 수십 초라 짧은 대기는 소음이다. */
    private static final long WAIT_LOG_THRESHOLD_MS = 1_000L;

    private final Semaphore turn = new Semaphore(1, true);
    private final long maxWaitMs;

    public LlmCallGate(AiLlmProperties aiLlmProperties) {
        this.maxWaitMs = aiLlmProperties.queueWaitMs();
    }

    /**
     * 차례를 받은 뒤 호출을 실행한다.
     *
     * @param operation 로그용 호출 종류 (plan / packing)
     * @param call 차례가 온 뒤에 실행할 모델 호출. <b>이 안에서 타임아웃 시계가 시작된다</b>
     * @throws AiPlanException 대기 예산 안에 차례를 받지 못하면 {@link AiPlanErrorCode#LLM_BUSY}
     *
     * <p><b>한계: 대기 중에는 취소를 보지 않는다.</b> 워커는 {@code DRAFTING} 체크포인트를 지난
     * 뒤 여기서 최대 {@code queue-wait-ms} 를 블로킹하므로, 그 사이의 취소는 차례가 온 뒤에야
     * 반영된다(돌아온 초안은 워커가 버린다 — 잘못된 결과가 나가지는 않고 GPU 시간만 버린다).
     * 취소를 게이트 대기 중에 보려면 포트 계약에 체크포인트를 넣어야 해서 별건으로 둔다.
     */
    public <T> T inTurn(String operation, Supplier<T> call) {
        long waitStartedAt = System.nanoTime();
        boolean acquired;
        try {
            acquired = turn.tryAcquire(maxWaitMs, TimeUnit.MILLISECONDS);
        } catch (InterruptedException exception) {
            // 인터럽트는 종료 신호지 혼잡이 아니다. 배포 중 잃은 잡에 "요청이 몰려 있습니다" 라고
            // 말하면 AIPLAN_021 의 뜻이 흐려진다. 플래그는 되살려 상위가 알아채게 한다.
            Thread.currentThread().interrupt();
            throw new AiPlanException(AiPlanErrorCode.LLM_UNAVAILABLE, exception);
        }

        if (!acquired) {
            // 앞선 호출이 제 타임아웃 안에 끝나지 않았다는 뜻이다. 여기서 더 기다리면
            // 사용자는 자기 차례도 못 받은 채 두 번째 타임아웃까지 본다.
            log.warn("LLM 차례를 기다리다 포기했습니다. operation={} waitedMs={} maxWaitMs={} queued={}",
                operation, elapsedMillis(waitStartedAt), maxWaitMs, turn.getQueueLength());
            throw new AiPlanException(AiPlanErrorCode.LLM_BUSY);
        }

        // 차례를 잡은 뒤로는 무슨 일이 있어도 돌려준다. 획득과 try 사이에 한 줄이라도 두면
        // 거기서 난 Error(OOM·로깅 appender 실패)가 permit 을 JVM 수명 동안 물고 있고,
        // 그 순간부터 모든 호출이 붐비지도 않는데 AIPLAN_021 로 죽는다 — 재기동 말고는 복구가 없다.
        try {
            long waitedMs = elapsedMillis(waitStartedAt);
            if (waitedMs >= WAIT_LOG_THRESHOLD_MS) {
                // 혼잡을 실제로 겪었다는 유일한 증거다. 이 값이 자주 크면 실효 동시성이 모자란
                // 것이고, 늘릴지는 GPU 재측정 뒤에 판단한다 (iGPU 공유 메모리라 올리면 개별
                // 소요가 늘 수 있다).
                log.info("LLM 차례를 기다린 뒤 호출합니다. operation={} waitedMs={} queued={}",
                    operation, waitedMs, turn.getQueueLength());
            }
            return call.get();
        } finally {
            turn.release();
        }
    }

    private long elapsedMillis(long startedAtNanos) {
        return Duration.ofNanos(System.nanoTime() - startedAtNanos).toMillis();
    }
}
