package com.hondigagae.domainlayer.planner.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.planner.application.exception.AiPlanErrorCode;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanException;
import com.hondigagae.domainlayer.planner.application.info.AiPlanJobInfo;
import com.hondigagae.domainlayer.planner.application.model.AiPlanJobSubscription;
import com.hondigagae.domainlayer.planner.application.port.out.AiPlanJobEventPort;
import com.hondigagae.domainlayer.planner.application.port.out.AiPlanJobStorePort;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJob;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJobStatus;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJobStep;
import com.hondigagae.global.properties.AiPlanJobProperties;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 작업 취소 (#90).
 *
 * <p>취소는 상태를 못 박는 일이라 규칙이 몇 개 안 되는데, 그 몇 개가 화면 동작을 갈른다.
 *
 * <ul>
 *   <li><b>남의 잡은 404</b> — 조회와 같은 규칙이다. 403 을 주면 그 jobId 가 존재한다는 사실이 새어 나간다</li>
 *   <li><b>이미 취소된 잡은 200</b> — 취소 버튼 두 번 누르는 것이 오류가 될 이유가 없다</li>
 *   <li><b>완료·실패한 잡은 409</b> — 취소할 것이 없다는 사실을 화면이 알아야 결과를 보여 줄 수 있다</li>
 *   <li><b>멱등 키를 함께 풀어 준다</b> — 취소하고 같은 조건으로 다시 넣는 것이 주된 쓰임인데,
 *       키가 남으면 취소된 잡을 그대로 돌려받는다</li>
 * </ul>
 */
class AiPlanJobCancelTest {

    private static final String JOB_ID = "job-1";
    private static final long MEMBER_ID = 7L;

    @Test
    @DisplayName("생성 중인 작업을 취소하면 CANCELED 로 못 박고 알린다")
    void cancelsRunningJob() {
        FakeStore store = new FakeStore(job(AiPlanJobStatus.RUNNING, AiPlanJobStep.CANDIDATES));
        FakeEvents events = new FakeEvents();

        AiPlanJobInfo info = processor(store, events).cancelJob(JOB_ID, MEMBER_ID);

        assertThat(info.status()).isEqualTo(AiPlanJobStatus.CANCELED);
        assertThat(store.saved.status()).isEqualTo(AiPlanJobStatus.CANCELED);
        assertThat(events.publishCount).isEqualTo(1);
        // 실패가 아니다. errorCode 를 채우면 화면이 "실패했습니다" 를 띄우고 지표에서도 장애와 섞인다.
        assertThat(info.errorCode()).isNull();
        // 어디까지 갔다가 멈췄는지는 남는다.
        assertThat(info.step()).isEqualTo(AiPlanJobStep.CANDIDATES);
    }

    @Test
    @DisplayName("대기 중인 작업도 취소할 수 있다")
    void cancelsPendingJob() {
        FakeStore store = new FakeStore(job(AiPlanJobStatus.PENDING, null));

        assertThat(processor(store, new FakeEvents()).cancelJob(JOB_ID, MEMBER_ID).status())
            .isEqualTo(AiPlanJobStatus.CANCELED);
    }

    @Test
    @DisplayName("취소하면 중복 방지 키를 풀어 준다 — 같은 조건으로 바로 다시 넣을 수 있어야 한다")
    void releasesIdempotencyKey() {
        FakeStore store = new FakeStore(job(AiPlanJobStatus.RUNNING, AiPlanJobStep.CONDITIONS));

        processor(store, new FakeEvents()).cancelJob(JOB_ID, MEMBER_ID);

        assertThat(store.releasedHash).isEqualTo("hash");
    }

    @Test
    @DisplayName("이미 취소된 작업을 또 취소하면 그대로 돌려준다 (멱등)")
    void isIdempotentOnAlreadyCanceledJob() {
        FakeStore store = new FakeStore(job(AiPlanJobStatus.CANCELED, AiPlanJobStep.CANDIDATES));
        FakeEvents events = new FakeEvents();

        assertThat(processor(store, events).cancelJob(JOB_ID, MEMBER_ID).status())
            .isEqualTo(AiPlanJobStatus.CANCELED);
        // 바뀐 것이 없으므로 다시 알리지 않는다.
        assertThat(events.publishCount).isZero();
        assertThat(store.saved).isNull();
    }

    @Test
    @DisplayName("완료된 작업은 409 로 거부한다 — 취소할 것이 없다")
    void rejectsCompletedJob() {
        FakeStore store = new FakeStore(completedJob());

        assertThatThrownBy(() -> processor(store, new FakeEvents()).cancelJob(JOB_ID, MEMBER_ID))
            .isInstanceOf(AiPlanException.class)
            .hasFieldOrPropertyWithValue("errorCode", AiPlanErrorCode.JOB_NOT_CANCELABLE);
        assertThat(store.saved).isNull();
    }

    @Test
    @DisplayName("실패한 작업도 409 다")
    void rejectsFailedJob() {
        FakeStore store = new FakeStore(job(AiPlanJobStatus.FAILED, AiPlanJobStep.DRAFTING));

        assertThatThrownBy(() -> processor(store, new FakeEvents()).cancelJob(JOB_ID, MEMBER_ID))
            .isInstanceOf(AiPlanException.class)
            .hasFieldOrPropertyWithValue("errorCode", AiPlanErrorCode.JOB_NOT_CANCELABLE);
    }

    @Test
    @DisplayName("남의 작업은 404 다 — 403 이면 그 jobId 가 있다는 사실이 새어 나간다")
    void hidesOtherMembersJob() {
        FakeStore store = new FakeStore(job(AiPlanJobStatus.RUNNING, AiPlanJobStep.CONDITIONS));

        assertThatThrownBy(() -> processor(store, new FakeEvents()).cancelJob(JOB_ID, MEMBER_ID + 1))
            .isInstanceOf(AiPlanException.class)
            .hasFieldOrPropertyWithValue("errorCode", AiPlanErrorCode.JOB_NOT_FOUND);
        assertThat(store.saved).isNull();
    }

    @Test
    @DisplayName("없는 작업은 404 다")
    void rejectsMissingJob() {
        FakeStore store = new FakeStore(null);

        assertThatThrownBy(() -> processor(store, new FakeEvents()).cancelJob(JOB_ID, MEMBER_ID))
            .isInstanceOf(AiPlanException.class)
            .hasFieldOrPropertyWithValue("errorCode", AiPlanErrorCode.JOB_NOT_FOUND);
    }

    // 픽스처 ──────────────────────────────────────────────────────────────

    /** 워커는 취소 경로에서 쓰이지 않으므로 넘기지 않는다 — 필요해지면 컴파일이 알려 준다. */
    private AiPlanJobProcessor processor(FakeStore store, FakeEvents events) {
        return new AiPlanJobProcessor(store, events, null, new AiPlanJobProperties(0, 0, 0));
    }

    private static AiPlanJob job(AiPlanJobStatus status, AiPlanJobStep step) {
        return AiPlanJob.builder()
            .jobId(JOB_ID)
            .memberId(MEMBER_ID)
            .requestHash("hash")
            .status(status)
            .step(step)
            .createdAt(Instant.now())
            .startedAt(status == AiPlanJobStatus.PENDING ? null : Instant.now())
            .build();
    }

    private static AiPlanJob completedJob() {
        return job(AiPlanJobStatus.RUNNING, AiPlanJobStep.DRAFTING)
            .completedWithDraft(AiPlanDraft.builder().days(List.of()).reasons(List.of()).build(), Instant.now());
    }

    private static final class FakeStore implements AiPlanJobStorePort {

        private final AiPlanJob stored;
        private AiPlanJob saved;
        private String releasedHash;

        private FakeStore(AiPlanJob stored) {
            this.stored = stored;
        }

        @Override
        public Optional<AiPlanJob> findById(String jobId) {
            return Optional.ofNullable(stored);
        }

        @Override
        public AiPlanJob save(AiPlanJob job) {
            saved = job;
            return job;
        }

        @Override
        public void releaseIdempotencyKey(Long memberId, String requestHash) {
            releasedHash = requestHash;
        }

        @Override
        public Optional<String> reserveOrGetExistingJobId(Long memberId, String requestHash, String newJobId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void deleteJob(String jobId) {
            throw new UnsupportedOperationException();
        }
    }

    private static final class FakeEvents implements AiPlanJobEventPort {

        private int publishCount;

        @Override
        public void publishJobUpdated(String jobId) {
            publishCount++;
        }

        @Override
        public AiPlanJobSubscription subscribe(String jobId, Runnable onJobUpdated) {
            throw new UnsupportedOperationException();
        }
    }
}
