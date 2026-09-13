package com.hondigagae.domainlayer.planner.adapter.out.llm;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.planner.application.exception.AiPlanErrorCode;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanException;
import com.hondigagae.global.properties.AiLlmProperties;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 모델 호출 직렬화와 타임아웃 기준점 (#508).
 *
 * <p>2026-09-13 dev 대조 실험이 고정하려는 사실이다 — 단독 66초 COMPLETED, 동시 2건은 둘 다
 * 123.5초 AIPLAN_020. 두 호출이 Ollama 안에서 겹치는 동안 각자의 read timeout 시계가 돌아
 * <b>남을 기다린 시간이 내 예산을 깎았다.</b>
 *
 * <p>그래서 여기서 보는 것은 둘이다.
 * <ul>
 *   <li>호출이 <b>겹치지 않는다</b> — 동시에 들어와도 한 번에 하나만 실행된다</li>
 *   <li>타임아웃 시계가 <b>차례가 온 뒤</b> 시작한다 — 기다린 시간은 호출 안에 들어오지 않는다</li>
 * </ul>
 */
class LlmCallGateTest {

    @Test
    @DisplayName("동시에 들어와도 모델 호출이 겹치지 않는다")
    void serializesConcurrentCalls() throws Exception {
        LlmCallGate gate = gate(5_000L);
        AtomicInteger inFlight = new AtomicInteger();
        AtomicInteger maxInFlight = new AtomicInteger();
        int callers = 4;
        CountDownLatch ready = new CountDownLatch(callers);
        CountDownLatch start = new CountDownLatch(1);

        ExecutorService pool = Executors.newFixedThreadPool(callers);
        try {
            List<Future<?>> futures = new java.util.ArrayList<>();
            for (int i = 0; i < callers; i++) {
                futures.add(pool.submit(() -> {
                    ready.countDown();
                    start.await();
                    return gate.inTurn("plan", () -> {
                        // 겹침은 "지금 몇 명이 안에 있나" 의 최댓값으로만 관측할 수 있다.
                        maxInFlight.accumulateAndGet(inFlight.incrementAndGet(), Math::max);
                        sleep(30);
                        inFlight.decrementAndGet();
                        return "ok";
                    });
                }));
            }
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            for (Future<?> future : futures) {
                assertThat(future.get(30, TimeUnit.SECONDS)).isEqualTo("ok");
            }
        } finally {
            pool.shutdownNow();
        }

        // 2 가 나오면 두 호출이 Ollama 안에서 서로를 기다리던 그 상태다.
        assertThat(maxInFlight.get()).isEqualTo(1);
    }

    @Test
    @DisplayName("타임아웃 시계는 차례가 온 뒤부터 돈다 — 남을 기다린 시간이 내 예산을 깎지 않는다")
    void startsTheClockAfterTheTurn() throws Exception {
        // 벽시계로 재지 않는다. "얼마나 기다렸나" 를 밀리초로 단언하면 스케줄링 지연 한 번에
        // 깨진다 — 여기서 볼 것은 시간이 아니라 순서다: 앞사람이 끝나기 전에는 내 호출이
        // 시작조차 하지 않는다.
        LlmCallGate gate = gate(5_000L);
        CountDownLatch holderInside = new CountDownLatch(1);
        CountDownLatch releaseHolder = new CountDownLatch(1);
        AtomicBoolean holderFinished = new AtomicBoolean();
        AtomicBoolean holderHadFinishedWhenMyCallStarted = new AtomicBoolean();

        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            pool.submit(() -> gate.inTurn("packing", () -> {
                holderInside.countDown();
                await(releaseHolder);
                holderFinished.set(true);
                return "held";
            }));
            assertThat(holderInside.await(5, TimeUnit.SECONDS)).isTrue();

            Future<String> second = pool.submit(() -> gate.inTurn("plan", () -> {
                // 이 시점이 "내 차례" 다. 여기서부터 read timeout 시계가 시작된다.
                holderHadFinishedWhenMyCallStarted.set(holderFinished.get());
                return "mine";
            }));

            // 앞사람을 붙잡아 둔 동안에는 뒷사람의 호출이 시작되지 않는다.
            assertThat(second.isDone()).isFalse();

            releaseHolder.countDown();
            assertThat(second.get(10, TimeUnit.SECONDS)).isEqualTo("mine");
        } finally {
            releaseHolder.countDown();
            pool.shutdownNow();
        }

        // 대기는 호출 밖에서 끝났다 — 내 호출이 시작될 때 앞사람은 이미 끝나 있었다.
        assertThat(holderHadFinishedWhenMyCallStarted).isTrue();
    }

    @Test
    @DisplayName("차례를 못 받으면 AIPLAN_021 로 가른다 — 조건 문제(AIPLAN_020)가 아니다")
    void tellsCongestionApartFromTimeout() throws Exception {
        // 대기 예산을 짧게 줘서 "앞사람이 제 턴 안에 끝내지 못한" 상황을 만든다.
        LlmCallGate gate = gate(50L);
        CountDownLatch holderInside = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);

        ExecutorService pool = Executors.newSingleThreadExecutor();
        try {
            pool.submit(() -> gate.inTurn("plan", () -> {
                holderInside.countDown();
                await(release);
                return "held";
            }));
            assertThat(holderInside.await(5, TimeUnit.SECONDS)).isTrue();

            assertThatThrownBy(() -> gate.inTurn("plan", () -> "never runs"))
                .isInstanceOf(AiPlanException.class)
                .hasFieldOrPropertyWithValue("errorCode", AiPlanErrorCode.LLM_BUSY);
        } finally {
            release.countDown();
            pool.shutdownNow();
        }
    }

    @Test
    @DisplayName("호출이 예외로 끝나도 차례를 돌려준다 — 실패 하나가 게이트를 영구히 막으면 안 된다")
    void releasesTheTurnOnFailure() {
        LlmCallGate gate = gate(1_000L);

        assertThatThrownBy(() -> gate.inTurn("plan", () -> {
            throw new IllegalStateException("모델 호출 실패");
        })).isInstanceOf(IllegalStateException.class);

        // 앞 호출이 세마포어를 물고 죽었다면 여기서 LLM_BUSY 가 난다.
        assertThat(gate.inTurn("plan", () -> "ok")).isEqualTo("ok");
    }

    private LlmCallGate gate(long queueWaitMs) {
        return new LlmCallGate(new AiLlmProperties(
            null, null, null, null, null, queueWaitMs, null, null, null, null, null));
    }

    private static void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(exception);
        }
    }

    private static void await(CountDownLatch latch) {
        try {
            latch.await(5, TimeUnit.SECONDS);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(exception);
        }
    }
}
