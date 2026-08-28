package com.hondigagae.domainlayer.planner.adapter.in.web.sse;

import com.hondigagae.domainlayer.planner.adapter.in.web.presenter.AiPlanPresenter;
import com.hondigagae.domainlayer.planner.application.info.AiPlanJobInfo;
import com.hondigagae.domainlayer.planner.application.model.AiPlanJobSubscription;
import com.hondigagae.domainlayer.planner.application.port.in.AiPlanWebUseCase;
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
import java.util.function.BooleanSupplier;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * AI 일정 잡 상태를 SSE 로 스트리밍한다.
 * 구독 즉시 현재 상태 스냅샷을 보내고, 이후 상태 변경 이벤트를 밀어주며, 종결 상태에서 연결을 닫는다.
 * 하트비트가 프록시 유휴 타임아웃을 막는 동시에 상태를 재확인하므로 pub/sub 이벤트가 유실돼도 스트림은 종결된다.
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
    // 상태 재확인은 유실된 종결 이벤트를 복구하는 폴백이라 매 하트비트마다 할 필요가 없다.
    // N 번에 한 번만 조회해 Redis 부하를 연결 수에 비례해 늘리지 않는다.
    private static final int STATUS_RECHECK_EVERY_N_HEARTBEATS = 3;

    private final AiPlanWebUseCase aiPlanWebUseCase;
    private final AiPlanPresenter aiPlanPresenter;
    private final long emitterTimeoutMs;
    private final ScheduledExecutorService heartbeatScheduler;

    public AiPlanJobSseStreamer(
        AiPlanWebUseCase aiPlanWebUseCase, AiPlanPresenter aiPlanPresenter, AiPlanJobProperties jobProperties
    ) {
        this.aiPlanWebUseCase = aiPlanWebUseCase;
        this.aiPlanPresenter = aiPlanPresenter;
        // 잡이 살아있을 수 있는 최대 시간(대기 + 실행 타임아웃)보다 길게 잡을 이유가 없다.
        this.emitterTimeoutMs = TimeUnit.SECONDS.toMillis(
            jobProperties.pendingTimeoutSeconds() + jobProperties.runningTimeoutSeconds() + EMITTER_TIMEOUT_MARGIN_SECONDS
        );
        AtomicInteger threadIndex = new AtomicInteger();
        this.heartbeatScheduler = Executors.newScheduledThreadPool(HEARTBEAT_THREADS, runnable -> {
            Thread thread = new Thread(runnable, "ai-plan-sse-heartbeat-" + threadIndex.incrementAndGet());
            thread.setDaemon(true);
            return thread;
        });
    }

    public SseEmitter stream(String jobId, long memberId) {
        // 소유권 검증과 초기 스냅샷 확보. 실패(JOB_NOT_FOUND 등)는 SSE 시작 전이므로 일반 JSON 오류로 응답된다.
        AiPlanJobInfo initial = aiPlanWebUseCase.getJobInfo(jobId, memberId);

        SseEmitter emitter = new SseEmitter(emitterTimeoutMs);
        if (initial.status().isTerminal()) {
            sendQuietly(emitter, initial);
            emitter.complete();
            return emitter;
        }

        AtomicBoolean closed = new AtomicBoolean(false);
        AtomicReference<AiPlanJobSubscription> subscriptionRef = new AtomicReference<>();
        AtomicReference<ScheduledFuture<?>> heartbeatRef = new AtomicReference<>();
        // 자원 정리는 최초 1회만 수행하고, "내가 처음 닫았는지"를 돌려준다.
        // 종결 감지는 pub/sub 콜백과 하트비트에서 동시에 일어날 수 있어
        // complete() 를 이 결과로 가드하지 않으면 중복 호출이 진행 중인 send 와 충돌한다.
        BooleanSupplier closeOnce = () -> {
            if (!closed.compareAndSet(false, true)) {
                return false;
            }
            AiPlanJobSubscription subscription = subscriptionRef.get();
            if (subscription != null) {
                subscription.unsubscribe();
            }
            ScheduledFuture<?> heartbeat = heartbeatRef.get();
            if (heartbeat != null) {
                heartbeat.cancel(false);
            }
            return true;
        };
        Runnable cleanup = closeOnce::getAsBoolean;
        Runnable closeStream = () -> {
            if (closeOnce.getAsBoolean()) {
                emitter.complete();
            }
        };
        emitter.onCompletion(cleanup);
        emitter.onError(throwable -> cleanup.run());
        emitter.onTimeout(closeStream);

        AtomicInteger heartbeatCount = new AtomicInteger();
        // 스냅샷 전송 전에 구독을 먼저 걸어 그 사이의 상태 전이를 놓치지 않는다.
        subscriptionRef.set(aiPlanWebUseCase.subscribeJobUpdates(
            jobId, memberId, info -> forward(emitter, info, cleanup, closeStream)
        ));
        heartbeatRef.set(heartbeatScheduler.scheduleAtFixedRate(
            () -> heartbeat(emitter, jobId, memberId, closed, cleanup, closeStream, heartbeatCount),
            HEARTBEAT_INTERVAL_SECONDS, HEARTBEAT_INTERVAL_SECONDS, TimeUnit.SECONDS
        ));

        forward(emitter, initial, cleanup, closeStream);
        return emitter;
    }

    private void forward(SseEmitter emitter, AiPlanJobInfo info, Runnable cleanup, Runnable closeStream) {
        if (!sendQuietly(emitter, info)) {
            cleanup.run();
            return;
        }
        if (info.status().isTerminal()) {
            closeStream.run();
        }
    }

    /**
     * 연결 유지용 코멘트를 보내고 상태를 재확인한다.
     * 재확인은 유실된 종결 이벤트를 복구하고, 멈춘 잡을 타임아웃 처리(expire)하는 폴백 역할을 한다.
     */
    private void heartbeat(
        SseEmitter emitter, String jobId, long memberId, AtomicBoolean closed,
        Runnable cleanup, Runnable closeStream, AtomicInteger heartbeatCount
    ) {
        if (closed.get()) {
            return;
        }
        try {
            synchronized (emitter) {
                emitter.send(SseEmitter.event().comment("ping"));
            }
            // 상태 재확인은 Redis 왕복이라 연결 수만큼 부하가 늘어난다.
            // 종결 이벤트 유실 복구용 폴백이므로 몇 번에 한 번만 확인해도 충분하다.
            if (heartbeatCount.incrementAndGet() % STATUS_RECHECK_EVERY_N_HEARTBEATS != 0) {
                return;
            }
            AiPlanJobInfo current = aiPlanWebUseCase.getJobInfo(jobId, memberId);
            if (current.status().isTerminal()) {
                forward(emitter, current, cleanup, closeStream);
            }
        } catch (IOException | RuntimeException exception) {
            log.debug("AI 일정 SSE 하트비트 중 연결을 정리합니다. jobId={} reason={}", jobId, exception.getMessage());
            cleanup.run();
        }
    }

    private boolean sendQuietly(SseEmitter emitter, AiPlanJobInfo info) {
        try {
            synchronized (emitter) {
                emitter.send(SseEmitter.event()
                    .name(EVENT_NAME)
                    .data(aiPlanPresenter.toJobStatusResponse(info), MediaType.APPLICATION_JSON));
            }
            return true;
        } catch (IOException | IllegalStateException exception) {
            // 클라이언트가 먼저 연결을 끊은 경우가 대부분이라 경고로 남기지 않는다.
            log.debug("AI 일정 SSE 전송에 실패했습니다. jobId={} reason={}", info.jobId(), exception.getMessage());
            return false;
        }
    }

    @PreDestroy
    void shutdown() {
        heartbeatScheduler.shutdownNow();
    }
}
