package com.hondigagae.global.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.global.properties.AiLlmProperties;
import com.hondigagae.global.properties.AiPlanJobProperties;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Executor;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * 일정 생성 워커 풀과 PENDING 타임아웃의 산술 (#508).
 *
 * <p><b>세 값은 한 세트다</b> — 동시 실행 · 대기열 · PENDING 타임아웃. 전에는 이 셋이 코드 세
 * 곳에 흩어져 있었고, "동시 실행 2" 라는 전제가 인프라(Ollama {@code NUM_PARALLEL=1})와 어긋난
 * 것을 아무도 잡지 못했다.
 *
 * <p><b>최악값을 여기에 상수로 적지 않는다.</b> 적어 두면 설정이 바뀔 때 이 숫자만 남아
 * 산술이 조용히 틀린다 — 실제로 이 수정을 하는 중에 PENDING 쪽은 게이트 대기를 빼고, RUNNING
 * 쪽은 더해서 같은 양을 다르게 세는 일이 있었다. 설정값에서 직접 계산해 그 사고를 막는다.
 */
class AiPlanTaskExecutorTest {

    private final List<ThreadPoolTaskExecutor> created = new ArrayList<>();

    /**
     * 내부 조회 1회의 read timeout(초). {@code application.yml} 의
     * {@code INTERNAL_CLIENT_READ_TIMEOUT_MS:5000} 과 같다.
     */
    private static final long INTERNAL_QUERY_TIMEOUT_SECONDS = 5L;

    /**
     * {@code AiPlanWorker#toQuery} 가 최악에 부르는 내부 조회 횟수 — 반려견 특성, 일정 개요,
     * 즐겨찾기, 후보 검색, 필수 포함 장소, 즐겨찾기 후보, 날씨 전망.
     *
     * <p>여기만 손으로 센 항이라 조회를 늘리면 함께 늘려야 한다. 처음에는 통째로 "약 15초" 로
     * 적었는데, 실제 최악은 35초라 산술의 여유를 20초 부풀려 보고하고 있었다.
     */
    private static final long INTERNAL_QUERY_COUNT = 7L;

    @Test
    @DisplayName("실효 동시성이 1이다 — Ollama 가 한 번에 하나만 추론하므로 늘려도 처리량이 늘지 않는다")
    void runsOneJobAtATime() {
        ThreadPoolTaskExecutor executor = taskExecutor();

        assertThat(executor.getCorePoolSize()).isEqualTo(1);
        assertThat(executor.getMaxPoolSize()).isEqualTo(1);
    }

    @Test
    @DisplayName("대기열 끝의 잡이 PENDING 타임아웃 안에 실행을 시작한다")
    void queueFitsInsidePendingTimeout() {
        ThreadPoolTaskExecutor executor = taskExecutor();
        long pendingTimeoutSeconds = defaultJobProperties().pendingTimeoutSeconds();

        // 실효 동시성이 1이라 라운드 수가 곧 대기열 길이다.
        long worstWaitSeconds = (long) executor.getQueueCapacity() * worstJobSeconds();

        assertThat(worstWaitSeconds)
            .as("대기열(%d) × 잡 최악값(%d초) 이 PENDING 타임아웃(%d초)을 넘으면 정상 대기가 FAILED 로 "
                + "판정된다 — 대기열이나 타임아웃 중 하나를 고칠 때 다른 쪽도 함께 고쳐야 한다",
                executor.getQueueCapacity(), worstJobSeconds(), pendingTimeoutSeconds)
            .isLessThanOrEqualTo(pendingTimeoutSeconds);
    }

    @Test
    @DisplayName("RUNNING 타임아웃도 같은 최악값을 덮는다 — 두 산술이 갈라지면 한쪽 기준의 대기열이 다른 쪽을 넘긴다")
    void runningTimeoutCoversTheSameWorstCase() {
        assertThat(worstJobSeconds())
            .as("게이트 대기 + 모델 호출 + 내부 조회 를 RUNNING 타임아웃이 덮어야 한다")
            .isLessThanOrEqualTo(defaultJobProperties().runningTimeoutSeconds());
    }

    @Test
    @DisplayName("대기열을 넘는 제출은 즉시 거절한다 — 5분 기다렸다 실패하는 것보다 낫다")
    void rejectsBeyondQueueCapacity() {
        ThreadPoolTaskExecutor executor = taskExecutor();

        // 실행 1 + 대기 1 = 동시 제출 2건까지. 3번째는 TaskRejectedException -> JOB_QUEUE_FULL(503).
        assertThat(executor.getMaxPoolSize() + executor.getQueueCapacity()).isEqualTo(2);
    }

    /**
     * 잡 1건이 워커 스레드를 쥐고 있는 벽시계 최악값(초).
     *
     * <p><b>게이트 대기를 반드시 더한다.</b> 드문 경로(동기 준비물 생성과 겹칠 때)라고 빼면
     * PENDING 산술이 RUNNING 산술과 어긋나고, 어긋난 쪽으로 대기열을 잡는 순간 대기열 끝의 잡이
     * 정상 대기 중에 타임아웃 FAILED 가 된다.
     */
    private long worstJobSeconds() {
        AiLlmProperties llm = defaultLlmProperties();
        return llm.queueWaitMs() / 1_000L
            + llm.timeoutMs() / 1_000L
            + INTERNAL_QUERY_TIMEOUT_SECONDS * INTERNAL_QUERY_COUNT;
    }

    private ThreadPoolTaskExecutor taskExecutor() {
        Executor executor = new AsyncConfig().aiPlanTaskExecutor();
        ThreadPoolTaskExecutor pool = (ThreadPoolTaskExecutor) executor;
        // initialize() 된 풀이라 정리한다. 지금은 코어 스레드를 prestart 하지 않아 무해하지만,
        // 그 설정이 붙는 순간 이 테스트가 조용히 스레드를 샌다.
        created.add(pool);
        return pool;
    }

    @AfterEach
    void shutdownExecutors() {
        created.forEach(ThreadPoolTaskExecutor::shutdown);
        created.clear();
    }

    /** 설정이 비었을 때의 기본값. 운영에서 환경변수로 덮이지만 산술의 기준은 이 값이다. */
    private AiPlanJobProperties defaultJobProperties() {
        return new AiPlanJobProperties(0L, 0L, 0L);
    }

    private AiLlmProperties defaultLlmProperties() {
        return new AiLlmProperties(null, null, null, null, null, null, null, null, null, null, null);
    }
}
