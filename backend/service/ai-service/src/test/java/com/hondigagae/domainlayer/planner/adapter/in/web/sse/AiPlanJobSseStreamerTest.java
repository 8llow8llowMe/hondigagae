package com.hondigagae.domainlayer.planner.adapter.in.web.sse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hondigagae.domainlayer.planner.adapter.in.web.dto.response.AiPlanJobStatusResponse;
import com.hondigagae.domainlayer.planner.adapter.in.web.presenter.AiPlanPresenter;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanErrorCode;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanException;
import com.hondigagae.domainlayer.planner.application.info.AiPlanJobInfo;
import com.hondigagae.domainlayer.planner.application.model.AiPlanJobSubscription;
import com.hondigagae.domainlayer.planner.application.port.in.AiPlanWebUseCase;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJobStatus;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJobStep;
import com.hondigagae.global.properties.AiPlanJobProperties;
import java.io.IOException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;
import java.util.function.Supplier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyEmitter.DataWithMediaType;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * 잡 SSE 의 전송 순서 (#985).
 *
 * <p>하루 재생성에서 화면이 3/4 에 수십 초 머무는 증상의 서버 쪽 원인이 여기 있었다. 스냅샷을 구독
 * <b>전에</b> 읽어 그 사이의 전이를 놓쳤고, 옛 스냅샷을 구독 <b>뒤에</b> 보내 콜백이 먼저 보낸 새 상태를
 * 덮을 수 있었고, 하트비트 재확인은 종결만 전달했다. 스레드 경합을 재현하는 대신 저장소 조회와 발행의
 * 순서를 손으로 끼워 넣는다.
 */
class AiPlanJobSseStreamerTest {

    private static final String JOB_ID = "job-1";
    private static final long MEMBER_ID = 7L;

    private final AiPlanWebUseCase useCase = mock(AiPlanWebUseCase.class);
    private final ScheduledExecutorService scheduler = mock(ScheduledExecutorService.class);
    private final ScheduledFuture<?> heartbeatFuture = mock(ScheduledFuture.class);
    /** 저장소 조회 차례. 조회마다 하나씩 꺼내 부른다 — 조회 도중에 일어나는 전이를 끼워 넣는 자리다. */
    private final Deque<Supplier<AiPlanJobInfo>> reads = new ArrayDeque<>();
    private final List<RecordingEmitter> emitters = new ArrayList<>();

    private Consumer<AiPlanJobInfo> subscriber;
    private int unsubscribeCount;
    /** 구독이 걸리는 순간 콜백에 넘길 상태. 구독 직후 종결 이벤트가 오는 경합을 재현한다. */
    private AiPlanJobInfo deliverOnSubscribe;
    /** 새로 만드는 emitter 의 send 가 던질 예외. */
    private IOException sendFailure;
    private Runnable heartbeat;

    private AiPlanJobSseStreamer streamer;

    @BeforeEach
    void setUp() {
        when(useCase.getJobInfo(JOB_ID, MEMBER_ID)).thenAnswer(invocation -> reads.pop().get());
        when(useCase.subscribeJobUpdates(eq(JOB_ID), eq(MEMBER_ID), any())).thenAnswer(invocation -> {
            subscriber = invocation.getArgument(2);
            if (deliverOnSubscribe != null) {
                subscriber.accept(deliverOnSubscribe);
            }
            return (AiPlanJobSubscription) () -> unsubscribeCount++;
        });
        when(scheduler.scheduleAtFixedRate(any(), anyLong(), anyLong(), eq(TimeUnit.SECONDS))).thenAnswer(invocation -> {
            heartbeat = invocation.getArgument(0);
            return heartbeatFuture;
        });
        streamer = streamerWith(new AiPlanPresenter());
    }

    private AiPlanJobSseStreamer streamerWith(AiPlanPresenter presenter) {
        return new AiPlanJobSseStreamer(useCase, presenter, new AiPlanJobProperties(0, 0, 0), scheduler, timeout -> {
            RecordingEmitter emitter = new RecordingEmitter(timeout, sendFailure);
            emitters.add(emitter);
            return emitter;
        });
    }

    @Test
    @DisplayName("소유권 확인과 구독 사이의 전이를 놓치지 않는다 — 구독 뒤 스냅샷을 다시 읽는다")
    void rereadsSnapshotAfterSubscribing() {
        reads.add(() -> {
            AiPlanJobInfo snapshot = running(AiPlanJobStep.CONDITIONS);
            // 워커가 다음 단계로 옮기고 발행한다. 아직 구독 전이라 이 이벤트는 누구에게도 가지 않는다.
            publish(running(AiPlanJobStep.CANDIDATES));
            return snapshot;
        });
        reads.add(() -> running(AiPlanJobStep.CANDIDATES));

        streamer.stream(JOB_ID, MEMBER_ID);

        assertThat(lastFrame().stepOrder()).isEqualTo(AiPlanJobStep.CANDIDATES.order());
    }

    @Test
    @DisplayName("재조회보다 먼저 온 콜백의 새 단계를 옛 스냅샷이 덮지 않는다")
    void staleSnapshotDoesNotOverwriteNewerCallbackFrame() {
        reads.add(() -> running(AiPlanJobStep.CONDITIONS));
        reads.add(() -> {
            AiPlanJobInfo stale = running(AiPlanJobStep.CONDITIONS);
            // 재조회가 읽은 직후 워커가 전이하고, 그 이벤트의 콜백이 스냅샷 전송보다 먼저 보낸다.
            publish(running(AiPlanJobStep.CANDIDATES));
            return stale;
        });

        streamer.stream(JOB_ID, MEMBER_ID);

        assertThat(frames()).extracting(AiPlanJobStatusResponse::stepOrder).containsExactly(AiPlanJobStep.CANDIDATES.order());
    }

    @Test
    @DisplayName("늦게 도착한 옛 단계 프레임은 버린다")
    void dropsLateOlderStepFrames() {
        reads.add(() -> running(AiPlanJobStep.CONDITIONS));
        reads.add(() -> running(AiPlanJobStep.CONDITIONS));
        streamer.stream(JOB_ID, MEMBER_ID);

        publish(running(AiPlanJobStep.DRAFTING));
        publish(running(AiPlanJobStep.WEATHER));
        publish(running(AiPlanJobStep.DRAFTING));

        assertThat(frames()).extracting(AiPlanJobStatusResponse::stepOrder)
            .containsExactly(AiPlanJobStep.CONDITIONS.order(), AiPlanJobStep.DRAFTING.order());
    }

    @Test
    @DisplayName("종결은 단계가 앞서도 항상 보내고 스트림을 닫는다")
    void alwaysSendsTerminalFrameAndCloses() {
        reads.add(() -> running(AiPlanJobStep.DRAFTING));
        reads.add(() -> running(AiPlanJobStep.DRAFTING));
        streamer.stream(JOB_ID, MEMBER_ID);

        // 실패 지점이 앞 단계로 기록된 종결이라도 가드에 걸리면 안 된다 — 화면이 끝을 모른다.
        publish(info(AiPlanJobStatus.FAILED, AiPlanJobStep.CANDIDATES));

        assertThat(lastFrame().status().code()).isEqualTo(AiPlanJobStatus.FAILED.name());
        assertThat(emitter().completed).isTrue();
        assertThat(unsubscribeCount).isEqualTo(1);
        verify(heartbeatFuture).cancel(false);
    }

    @Test
    @DisplayName("하트비트 재확인이 놓친 단계 전이를 전달하고, 같은 단계는 다시 보내지 않는다")
    void heartbeatDeliversMissedStepChange() {
        reads.add(() -> running(AiPlanJobStep.CONDITIONS));
        reads.add(() -> running(AiPlanJobStep.CONDITIONS));
        streamer.stream(JOB_ID, MEMBER_ID);

        // pub/sub 이 WEATHER 이벤트를 흘렸다. 재확인은 N 번째 하트비트마다 한다.
        reads.add(() -> running(AiPlanJobStep.WEATHER));
        runHeartbeats(AiPlanJobSseStreamer.STATUS_RECHECK_EVERY_N_HEARTBEATS);
        reads.add(() -> running(AiPlanJobStep.WEATHER));
        runHeartbeats(AiPlanJobSseStreamer.STATUS_RECHECK_EVERY_N_HEARTBEATS);

        assertThat(frames()).extracting(AiPlanJobStatusResponse::stepOrder)
            .containsExactly(AiPlanJobStep.CONDITIONS.order(), AiPlanJobStep.WEATHER.order());
        assertThat(emitter().completed).isFalse();
    }

    @Test
    @DisplayName("하트비트 재확인이 종결을 보면 보내고 닫는다")
    void heartbeatDeliversTerminal() {
        reads.add(() -> running(AiPlanJobStep.DRAFTING));
        reads.add(() -> running(AiPlanJobStep.DRAFTING));
        streamer.stream(JOB_ID, MEMBER_ID);

        reads.add(() -> info(AiPlanJobStatus.COMPLETED, AiPlanJobStep.DRAFTING));
        runHeartbeats(AiPlanJobSseStreamer.STATUS_RECHECK_EVERY_N_HEARTBEATS);

        assertThat(lastFrame().status().code()).isEqualTo(AiPlanJobStatus.COMPLETED.name());
        assertThat(emitter().completed).isTrue();
    }

    @Test
    @DisplayName("남의 jobId 는 SSE 를 열기 전에 404 로 끝난다 — 구독도 emitter 도 만들지 않는다")
    void rejectsOtherMembersJobBeforeOpeningStream() {
        reads.add(() -> {
            throw new AiPlanException(AiPlanErrorCode.JOB_NOT_FOUND);
        });

        assertThatThrownBy(() -> streamer.stream(JOB_ID, MEMBER_ID))
            .isInstanceOf(AiPlanException.class)
            .hasFieldOrPropertyWithValue("errorCode", AiPlanErrorCode.JOB_NOT_FOUND);
        assertThat(emitters).isEmpty();
        verify(useCase, never()).subscribeJobUpdates(any(), anyLong(), any());
    }

    @Test
    @DisplayName("이미 끝난 작업은 한 번 보내고 닫는다 — 구독하지 않는다")
    void terminalJobIsSentOnceWithoutSubscribing() {
        reads.add(() -> info(AiPlanJobStatus.COMPLETED, AiPlanJobStep.DRAFTING));

        streamer.stream(JOB_ID, MEMBER_ID);

        assertThat(frames()).hasSize(1);
        assertThat(emitter().completed).isTrue();
        verify(useCase, never()).subscribeJobUpdates(any(), anyLong(), any());
    }

    @Test
    @DisplayName("구독 뒤 재조회가 실패하면 첫 조회로 대신 보낸다")
    void fallsBackToOwnershipSnapshotWhenRereadFails() {
        reads.add(() -> running(AiPlanJobStep.CONDITIONS));
        reads.add(() -> {
            throw new AiPlanException(AiPlanErrorCode.JOB_STORE_UNAVAILABLE);
        });

        streamer.stream(JOB_ID, MEMBER_ID);

        assertThat(frames()).extracting(AiPlanJobStatusResponse::stepOrder).containsExactly(AiPlanJobStep.CONDITIONS.order());
    }

    @Test
    @DisplayName("진행 순위는 PENDING < 단계 전 RUNNING < 단계 순서 < 종결 이다")
    void progressRankOrdersFrames() {
        assertThat(AiPlanJobSseStreamer.progressRank(info(AiPlanJobStatus.PENDING, null)))
            .isLessThan(AiPlanJobSseStreamer.progressRank(info(AiPlanJobStatus.RUNNING, null)));
        assertThat(AiPlanJobSseStreamer.progressRank(info(AiPlanJobStatus.RUNNING, null)))
            .isLessThan(AiPlanJobSseStreamer.progressRank(running(AiPlanJobStep.CONDITIONS)));
        assertThat(AiPlanJobSseStreamer.progressRank(running(AiPlanJobStep.WEATHER)))
            .isLessThan(AiPlanJobSseStreamer.progressRank(running(AiPlanJobStep.DRAFTING)));
        assertThat(AiPlanJobSseStreamer.progressRank(running(AiPlanJobStep.DRAFTING)))
            .isLessThan(AiPlanJobSseStreamer.progressRank(info(AiPlanJobStatus.CANCELED, null)));
    }

    // 종료 경로 — 어느 길로 닫혀도 구독과 하트비트가 한 번씩 풀린다 ──────────────

    @Test
    @DisplayName("응답 변환이 실패하면 연결을 닫는다 — 순위를 올린 채 남아 종결을 영영 못 보내지 않는다")
    void closesStreamWhenPresenterFails() {
        AiPlanJobSseStreamer failing = streamerWith(new AiPlanPresenter() {
            @Override
            public AiPlanJobStatusResponse toJobStatusResponse(AiPlanJobInfo info) {
                if (info.status().isTerminal()) {
                    throw new IllegalArgumentException("broken terminal frame");
                }
                return super.toJobStatusResponse(info);
            }
        });
        reads.add(() -> running(AiPlanJobStep.DRAFTING));
        reads.add(() -> running(AiPlanJobStep.DRAFTING));
        failing.stream(JOB_ID, MEMBER_ID);

        publish(info(AiPlanJobStatus.COMPLETED, AiPlanJobStep.DRAFTING));

        assertThat(emitter().completed).isTrue();
        assertThat(unsubscribeCount).isEqualTo(1);
        verify(heartbeatFuture, times(1)).cancel(false);
    }

    @Test
    @DisplayName("구독이 걸리자마자 종결되면 늦게 붙은 구독·하트비트를 정확히 한 번씩 푼다")
    void releasesResourcesOnceWhenTerminalArrivesDuringSubscribe() {
        deliverOnSubscribe = info(AiPlanJobStatus.COMPLETED, AiPlanJobStep.DRAFTING);
        reads.add(() -> running(AiPlanJobStep.DRAFTING));
        reads.add(() -> info(AiPlanJobStatus.COMPLETED, AiPlanJobStep.DRAFTING));

        streamer.stream(JOB_ID, MEMBER_ID);

        assertThat(frames()).extracting(frame -> frame.status().code()).containsExactly(AiPlanJobStatus.COMPLETED.name());
        assertThat(emitter().completed).isTrue();
        assertThat(unsubscribeCount).isEqualTo(1);
        verify(heartbeatFuture, times(1)).cancel(false);
    }

    @Test
    @DisplayName("전송이 IOException 이면 구독을 풀고 하트비트를 멈춘다")
    void releasesResourcesWhenSendFails() {
        sendFailure = new IOException("broken pipe");
        reads.add(() -> running(AiPlanJobStep.CONDITIONS));
        reads.add(() -> running(AiPlanJobStep.CONDITIONS));

        streamer.stream(JOB_ID, MEMBER_ID);

        assertThat(unsubscribeCount).isEqualTo(1);
        verify(heartbeatFuture, times(1)).cancel(false);
        // 닫힌 뒤의 이벤트·하트비트는 아무것도 하지 않는다.
        publish(running(AiPlanJobStep.CANDIDATES));
        runHeartbeats(AiPlanJobSseStreamer.STATUS_RECHECK_EVERY_N_HEARTBEATS);
        assertThat(unsubscribeCount).isEqualTo(1);
    }

    @Test
    @DisplayName("emitter 타임아웃이면 닫고 자원을 푼다")
    void closesOnEmitterTimeout() {
        reads.add(() -> running(AiPlanJobStep.CONDITIONS));
        reads.add(() -> running(AiPlanJobStep.CONDITIONS));
        streamer.stream(JOB_ID, MEMBER_ID);

        emitter().timeoutCallback.run();
        emitter().timeoutCallback.run();

        assertThat(emitter().completed).isTrue();
        assertThat(unsubscribeCount).isEqualTo(1);
        verify(heartbeatFuture, times(1)).cancel(false);
    }

    @Test
    @DisplayName("연결 오류면 자원을 풀고, 뒤이은 완료 콜백은 다시 풀지 않는다")
    void releasesOnceOnEmitterErrorThenCompletion() {
        reads.add(() -> running(AiPlanJobStep.CONDITIONS));
        reads.add(() -> running(AiPlanJobStep.CONDITIONS));
        streamer.stream(JOB_ID, MEMBER_ID);

        emitter().errorCallback.accept(new IOException("client gone"));
        emitter().completionCallback.run();

        assertThat(unsubscribeCount).isEqualTo(1);
        verify(heartbeatFuture, times(1)).cancel(false);
    }

    // 픽스처 ──────────────────────────────────────────────────────────────

    /** 워커의 발행을 흉내 낸다. 구독 전이면 사라진다 — Redis pub/sub 이 그렇다. */
    private void publish(AiPlanJobInfo info) {
        if (subscriber != null) {
            subscriber.accept(info);
        }
    }

    private void runHeartbeats(int times) {
        for (int i = 0; i < times; i++) {
            heartbeat.run();
        }
    }

    private static AiPlanJobInfo running(AiPlanJobStep step) {
        return info(AiPlanJobStatus.RUNNING, step);
    }

    private static AiPlanJobInfo info(AiPlanJobStatus status, AiPlanJobStep step) {
        return AiPlanJobInfo.builder().jobId(JOB_ID).status(status).step(step).build();
    }

    private RecordingEmitter emitter() {
        assertThat(emitters).hasSize(1);
        return emitters.getFirst();
    }

    private List<AiPlanJobStatusResponse> frames() {
        return emitter().frames;
    }

    private AiPlanJobStatusResponse lastFrame() {
        assertThat(frames()).isNotEmpty();
        return frames().getLast();
    }

    /** 보낸 잡 프레임을 순서대로 모은다. 하트비트 ping(코멘트)은 데이터가 아니라 모으지 않는다. */
    private static final class RecordingEmitter extends SseEmitter {

        private final List<AiPlanJobStatusResponse> frames = new ArrayList<>();
        private final IOException sendFailure;
        private boolean completed;
        private Runnable timeoutCallback;
        private Runnable completionCallback;
        private Consumer<Throwable> errorCallback;

        private RecordingEmitter(Long timeout, IOException sendFailure) {
            super(timeout);
            this.sendFailure = sendFailure;
        }

        @Override
        public void onTimeout(Runnable callback) {
            timeoutCallback = callback;
        }

        @Override
        public void onCompletion(Runnable callback) {
            completionCallback = callback;
        }

        @Override
        public void onError(Consumer<Throwable> callback) {
            errorCallback = callback;
        }

        @Override
        public void send(SseEventBuilder builder) throws IOException {
            if (sendFailure != null) {
                throw sendFailure;
            }
            for (DataWithMediaType part : builder.build()) {
                if (part.getData() instanceof AiPlanJobStatusResponse response) {
                    frames.add(response);
                }
            }
        }

        @Override
        public void complete() {
            completed = true;
        }
    }
}
