package com.hondigagae.domainlayer.planner.adapter.in.web.sse;

import com.hondigagae.domainlayer.planner.adapter.in.web.presenter.AiPlanPresenter;
import com.hondigagae.domainlayer.planner.application.info.AiPlanJobInfo;
import com.hondigagae.domainlayer.planner.application.model.AiPlanJobSubscription;
import com.hondigagae.domainlayer.planner.application.port.in.AiPlanWebUseCase;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJobStatus;
import com.hondigagae.global.properties.AiPlanJobProperties;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.LongFunction;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * AI 일정 잡 상태를 SSE 로 스트리밍한다.
 *
 * <p>구독을 먼저 걸고 현재 상태 스냅샷을 다시 읽어 보내며, 이후 상태 변경 이벤트를 밀어주고,
 * 종결 상태에서 연결을 닫는다. 하트비트가 프록시 유휴 타임아웃을 막는 동시에 상태를 재확인하므로
 * pub/sub 이벤트가 유실돼도 스트림은 종결되고, 놓친 단계 전이도 결국 전달된다.
 *
 * <h2>순서 (#985)</h2>
 *
 * <ol>
 *   <li><b>소유권 확인</b> — 남의 jobId 는 여기서 404 {@code AIPLAN_002} 로 끝난다. SSE 시작 전이라
 *       일반 JSON 오류 봉투로 나가고, 구독도 걸지 않는다</li>
 *   <li><b>구독</b> — 이후의 전이는 콜백이 받는다</li>
 *   <li><b>스냅샷 재조회 → 전송</b> — 1 과 2 사이에 일어난 전이는 이벤트로 오지 않으므로(구독 전 발행)
 *       구독 뒤에 다시 읽어야 잡힌다. 1 의 결과를 그대로 보내면 그 전이를 통째로 놓친다</li>
 * </ol>
 *
 * <h2>단조 가드 — 뒤처진 프레임은 보내지 않는다</h2>
 *
 * 스냅샷 전송(요청 스레드), 구독 콜백(pub/sub 리스너 스레드), 하트비트 재확인(스케줄러 스레드)은
 * 서로 다른 스레드에서 각자 저장소를 읽고 보낸다. 먼저 읽은 쪽이 나중에 보내면 <b>옛 단계가 마지막
 * 프레임</b>이 되고, 화면은 다음 이벤트가 올 때까지 거꾸로 간 진행을 그린다. 그래서 연결마다 이미
 * 보낸 프레임의 진행 순위를 들고, 다음 규칙으로 거른다 ({@link #progressRank}).
 *
 * <ul>
 *   <li>순위는 PENDING &lt; RUNNING(단계 전) &lt; RUNNING {@code stepOrder} 1..n &lt; 종결 이다</li>
 *   <li><b>이미 보낸 순위보다 큰 프레임만 보낸다.</b> 같은 순위는 같은 내용이라 다시 보내지 않는다</li>
 *   <li><b>종결은 단계와 관계없이 항상 보낸다</b> — 가장 높은 순위다. 실패는 앞 단계에서도 날 수 있다.
 *       빠지는 경우는 이미 종결을 보낸 뒤뿐이고, 그때 스트림은 닫힌다</li>
 *   <li>순위 비교·갱신·전송은 emitter 잠금 안에서 한 번에 한다. 나눠 하면 두 스레드가 같이 통과한 뒤
 *       전송 순서가 뒤집힌다</li>
 * </ul>
 */
@Slf4j
@Component
public class AiPlanJobSseStreamer {

    private static final String EVENT_NAME = "job-update";
    private static final long HEARTBEAT_INTERVAL_SECONDS = 25L;
    private static final long EMITTER_TIMEOUT_MARGIN_SECONDS = 30L;
    // 하트비트는 연결 수만큼 반복 실행되고 상태 재확인이 Redis 왕복을 포함한다.
    // 단일 스레드면 동시 연결이 늘 때 ping 이 밀려 프록시 유휴 타임아웃에 걸릴 수 있다.
    private static final int HEARTBEAT_THREADS = 4;
    // 상태 재확인은 유실된 이벤트를 복구하는 폴백이라 매 하트비트마다 할 필요가 없다.
    // N 번에 한 번만 조회해 Redis 부하를 연결 수에 비례해 늘리지 않는다.
    static final int STATUS_RECHECK_EVERY_N_HEARTBEATS = 3;

    private static final int RANK_PENDING = 0;
    private static final int RANK_RUNNING_BEFORE_STEP = 1;
    private static final int RANK_TERMINAL = Integer.MAX_VALUE;

    private final AiPlanWebUseCase aiPlanWebUseCase;
    private final AiPlanPresenter aiPlanPresenter;
    private final long emitterTimeoutMs;
    private final ScheduledExecutorService heartbeatScheduler;
    private final LongFunction<SseEmitter> emitterFactory;

    @Autowired
    public AiPlanJobSseStreamer(
        AiPlanWebUseCase aiPlanWebUseCase, AiPlanPresenter aiPlanPresenter, AiPlanJobProperties jobProperties
    ) {
        this(aiPlanWebUseCase, aiPlanPresenter, jobProperties, newHeartbeatScheduler(), SseEmitter::new);
    }

    /** 테스트가 하트비트를 직접 돌리고 보낸 프레임을 읽을 수 있도록 스케줄러와 emitter 를 받는다. */
    AiPlanJobSseStreamer(
        AiPlanWebUseCase aiPlanWebUseCase, AiPlanPresenter aiPlanPresenter, AiPlanJobProperties jobProperties,
        ScheduledExecutorService heartbeatScheduler, LongFunction<SseEmitter> emitterFactory
    ) {
        this.aiPlanWebUseCase = aiPlanWebUseCase;
        this.aiPlanPresenter = aiPlanPresenter;
        // 잡이 살아있을 수 있는 최대 시간(대기 + 실행 타임아웃)보다 길게 잡을 이유가 없다.
        this.emitterTimeoutMs = TimeUnit.SECONDS.toMillis(
            jobProperties.pendingTimeoutSeconds() + jobProperties.runningTimeoutSeconds() + EMITTER_TIMEOUT_MARGIN_SECONDS
        );
        this.heartbeatScheduler = heartbeatScheduler;
        this.emitterFactory = emitterFactory;
    }

    private static ScheduledExecutorService newHeartbeatScheduler() {
        AtomicInteger threadIndex = new AtomicInteger();
        return Executors.newScheduledThreadPool(HEARTBEAT_THREADS, runnable -> {
            Thread thread = new Thread(runnable, "ai-plan-sse-heartbeat-" + threadIndex.incrementAndGet());
            thread.setDaemon(true);
            return thread;
        });
    }

    public SseEmitter stream(String jobId, long memberId) {
        // 1. 소유권 확인. 실패(JOB_NOT_FOUND 등)는 SSE 시작 전이므로 일반 JSON 오류로 응답된다.
        AiPlanJobInfo owned = aiPlanWebUseCase.getJobInfo(jobId, memberId);

        JobStream jobStream = new JobStream(emitterFactory.apply(emitterTimeoutMs), jobId, memberId);
        if (owned.status().isTerminal()) {
            // 더 바뀌지 않으니 구독할 것이 없다.
            jobStream.forward(owned);
            return jobStream.emitter;
        }

        // 2. 구독. 3. 구독 뒤에 다시 읽어 1 과 2 사이의 전이를 잡는다.
        jobStream.open();
        jobStream.forward(jobStream.rereadOr(owned));
        return jobStream.emitter;
    }

    /**
     * 프레임의 진행 순위. 클수록 뒤의 상태다 — 클래스 머리주석 "단조 가드" 의 규칙이다.
     * 종결은 단계와 관계없이 가장 크다.
     */
    static int progressRank(AiPlanJobInfo info) {
        if (info.status().isTerminal()) {
            return RANK_TERMINAL;
        }
        if (info.status() == AiPlanJobStatus.PENDING) {
            return RANK_PENDING;
        }
        return info.step() == null ? RANK_RUNNING_BEFORE_STEP : RANK_RUNNING_BEFORE_STEP + info.step().order();
    }

    /** 연결 하나의 상태. 구독·하트비트·이미 보낸 순위가 연결 단위라 여기 모은다. */
    private final class JobStream {

        private final SseEmitter emitter;
        private final String jobId;
        private final long memberId;
        private final AtomicBoolean closed = new AtomicBoolean(false);
        private final AtomicReference<AiPlanJobSubscription> subscriptionRef = new AtomicReference<>();
        private final AtomicReference<ScheduledFuture<?>> heartbeatRef = new AtomicReference<>();
        private final AtomicInteger heartbeatCount = new AtomicInteger();
        /** 이미 보낸 프레임의 최대 순위. emitter 잠금 안에서만 읽고 쓴다. */
        private int lastSentRank = -1;

        private JobStream(SseEmitter emitter, String jobId, long memberId) {
            this.emitter = emitter;
            this.jobId = jobId;
            this.memberId = memberId;
        }

        private void open() {
            emitter.onCompletion(this::cleanup);
            emitter.onError(throwable -> cleanup());
            emitter.onTimeout(this::closeStream);
            subscriptionRef.set(aiPlanWebUseCase.subscribeJobUpdates(jobId, memberId, this::forward));
            heartbeatRef.set(heartbeatScheduler.scheduleAtFixedRate(
                this::heartbeat, HEARTBEAT_INTERVAL_SECONDS, HEARTBEAT_INTERVAL_SECONDS, TimeUnit.SECONDS
            ));
            // 구독이 걸리자마자 종결 이벤트가 와 이미 닫혔을 수 있다. 그때의 정리는 참조가 비어 있어 건너뛰었으므로 여기서 푼다.
            if (closed.get()) {
                releaseResources();
            }
        }

        /** 구독 뒤의 스냅샷. 다시 읽지 못하면(Redis 순단 등) 소유권 확인 때 읽은 것으로 대신한다 — 가드가 순서를 지킨다. */
        private AiPlanJobInfo rereadOr(AiPlanJobInfo fallback) {
            try {
                return aiPlanWebUseCase.getJobInfo(jobId, memberId);
            } catch (RuntimeException exception) {
                log.debug("AI 일정 SSE 구독 뒤 스냅샷 재조회에 실패해 첫 조회로 대신합니다. jobId={} reason={}", jobId, exception.getMessage());
                return fallback;
            }
        }

        private void forward(AiPlanJobInfo info) {
            Delivery delivery = sendIfAhead(info);
            if (delivery == Delivery.FAILED) {
                cleanup();
                return;
            }
            if (delivery == Delivery.SENT && info.status().isTerminal()) {
                closeStream();
            }
        }

        private Delivery sendIfAhead(AiPlanJobInfo info) {
            synchronized (emitter) {
                if (closed.get()) {
                    return Delivery.SKIPPED;
                }
                int rank = progressRank(info);
                if (rank <= lastSentRank) {
                    return Delivery.SKIPPED;
                }
                lastSentRank = rank;
                try {
                    emitter.send(SseEmitter.event()
                        .name(EVENT_NAME)
                        .data(aiPlanPresenter.toJobStatusResponse(info), MediaType.APPLICATION_JSON));
                    return Delivery.SENT;
                } catch (IOException | IllegalStateException exception) {
                    // 클라이언트가 먼저 연결을 끊은 경우가 대부분이라 경고로 남기지 않는다.
                    log.debug("AI 일정 SSE 전송에 실패했습니다. jobId={} reason={}", info.jobId(), exception.getMessage());
                    return Delivery.FAILED;
                }
            }
        }

        /**
         * 연결 유지용 코멘트를 보내고 상태를 재확인한다.
         *
         * <p>재확인은 유실된 이벤트를 복구하고, 멈춘 잡을 타임아웃 처리(expire)하는 폴백이다.
         * 종결만이 아니라 <b>단계 전이도 전달한다</b> — pub/sub 이 단계 이벤트를 흘리면 화면이 다음
         * 이벤트까지 옛 단계에 머물기 때문이다. 같은 단계면 단조 가드가 거른다.
         */
        private void heartbeat() {
            if (closed.get()) {
                return;
            }
            try {
                synchronized (emitter) {
                    emitter.send(SseEmitter.event().comment("ping"));
                }
                // 상태 재확인은 Redis 왕복이라 연결 수만큼 부하가 늘어난다. 몇 번에 한 번만 확인한다.
                if (heartbeatCount.incrementAndGet() % STATUS_RECHECK_EVERY_N_HEARTBEATS != 0) {
                    return;
                }
                forward(aiPlanWebUseCase.getJobInfo(jobId, memberId));
            } catch (IOException | RuntimeException exception) {
                // 상태 재확인 실패(Redis 순단 등)도 여기로 온다. 구독만 정리하고 emitter 를 열어 두면
                // 어떤 이벤트도 오지 않는 좀비 연결이 emitter 타임아웃까지 남는다 — 닫아서 클라이언트가
                // 즉시 재연결(폴백 폴링)하게 한다.
                log.debug("AI 일정 SSE 하트비트 중 연결을 정리합니다. jobId={} reason={}", jobId, exception.getMessage());
                closeStream();
            }
        }

        /**
         * 자원만 정리한다. "내가 처음 닫았는지"로 가드한다 — 종결 감지는 pub/sub 콜백과 하트비트에서
         * 동시에 일어날 수 있어, 가드하지 않으면 중복 complete() 가 진행 중인 send 와 충돌한다.
         */
        private void cleanup() {
            if (closed.compareAndSet(false, true)) {
                releaseResources();
            }
        }

        private void closeStream() {
            if (!closed.compareAndSet(false, true)) {
                return;
            }
            releaseResources();
            try {
                emitter.complete();
            } catch (RuntimeException exception) {
                // 이미 끊긴 연결의 complete 는 실패할 수 있다. 자원 정리는 위에서 끝났다.
                log.debug("AI 일정 SSE 종료 처리에 실패했습니다. reason={}", exception.getMessage());
            }
        }

        /** 여러 번 불려도 한 번만 푼다. 참조를 비우며 꺼내기 때문이다. */
        private void releaseResources() {
            AiPlanJobSubscription subscription = subscriptionRef.getAndSet(null);
            if (subscription != null) {
                subscription.unsubscribe();
            }
            ScheduledFuture<?> heartbeat = heartbeatRef.getAndSet(null);
            if (heartbeat != null) {
                heartbeat.cancel(false);
            }
        }
    }

    private enum Delivery {
        SENT, SKIPPED, FAILED
    }

    @PreDestroy
    void shutdown() {
        heartbeatScheduler.shutdownNow();
    }
}
