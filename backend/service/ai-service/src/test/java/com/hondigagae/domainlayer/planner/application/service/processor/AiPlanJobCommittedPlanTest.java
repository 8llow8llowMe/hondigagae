package com.hondigagae.domainlayer.planner.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.planner.application.exception.AiPlanErrorCode;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanException;
import com.hondigagae.domainlayer.planner.application.info.AiPlanJobInfo;
import com.hondigagae.domainlayer.planner.application.model.AiPlanJobSubscription;
import com.hondigagae.domainlayer.planner.application.port.out.AiPlanJobEventPort;
import com.hondigagae.domainlayer.planner.application.port.out.AiPlanJobStorePort;
import com.hondigagae.domainlayer.planner.application.port.out.PlanAiCommitQueryPort;
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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

/**
 * 잡 조회에 담은 일정을 싣는다 (#970).
 *
 * <p>담긴 사실의 정본은 plan-service 라 조회 때마다 묻는다. 규칙은 셋이다.
 *
 * <ul>
 *   <li><b>COMPLETED 일 때만 묻는다</b> — 초안이 없으면 담을 것도 없다. 대기·실행 중 폴링·SSE 이벤트마다
 *       원격 호출이 붙으면 plan-service 부하가 연결 수에 비례해 는다</li>
 *   <li><b>소유권 검증 뒤에만 묻는다</b> — 남의 jobId 로 plan-service 까지 가면 안 된다
 *       ({@code AiPlanJobConditionsExposureTest} 와 같은 노출 순서 원칙)</li>
 *   <li><b>못 물으면 null</b> — 포트가 관용이라 조회 자체는 실패하지 않는다</li>
 * </ul>
 */
class AiPlanJobCommittedPlanTest {

    private static final String JOB_ID = "job-1";
    private static final long OWNER_ID = 7L;
    private static final long COMMITTED_PLAN_ID = 1234567890123456789L;

    @Test
    @DisplayName("완료된 작업은 plan-service 에 물어 담은 일정 아이디를 싣는다")
    void carriesCommittedPlanIdWhenCompleted() {
        CountingPort port = new CountingPort(Optional.of(COMMITTED_PLAN_ID));

        AiPlanJobInfo info = processor(new FakeStore(completedJob()), port).getJobInfo(JOB_ID, OWNER_ID);

        assertThat(info.committedPlanId()).isEqualTo(COMMITTED_PLAN_ID);
        assertThat(port.calls).isEqualTo(1);
        // 잡의 주인과 그 jobId 로 묻는다 — 요청자 memberId 가 아니라 잡에 적힌 값이지만 소유권 검증 뒤라 같다.
        assertThat(port.lastMemberId).isEqualTo(OWNER_ID);
        assertThat(port.lastJobId).isEqualTo(JOB_ID);
    }

    @ParameterizedTest
    @EnumSource(value = AiPlanJobStatus.class, names = {"PENDING", "RUNNING", "FAILED", "CANCELED"})
    @DisplayName("완료되지 않은 작업은 묻지 않고 null 이다")
    void skipsLookupUnlessCompleted(AiPlanJobStatus status) {
        CountingPort port = new CountingPort(Optional.of(COMMITTED_PLAN_ID));

        AiPlanJobInfo info = processor(new FakeStore(job(status)), port).getJobInfo(JOB_ID, OWNER_ID);

        assertThat(info.status()).isEqualTo(status);
        assertThat(info.committedPlanId()).isNull();
        assertThat(port.calls).isZero();
    }

    @Test
    @DisplayName("남의 작업은 404 이고 plan-service 까지 가지 않는다")
    void hidesOtherMembersJobBeforeLookup() {
        CountingPort port = new CountingPort(Optional.of(COMMITTED_PLAN_ID));
        AiPlanJobProcessor processor = processor(new FakeStore(completedJob()), port);

        assertThatThrownBy(() -> processor.getJobInfo(JOB_ID, OWNER_ID + 1))
            .isInstanceOf(AiPlanException.class)
            .hasFieldOrPropertyWithValue("errorCode", AiPlanErrorCode.JOB_NOT_FOUND);
        assertThat(port.calls).isZero();
    }

    @Test
    @DisplayName("담은 적이 없거나 조회에 실패하면(포트가 비어 있으면) null 이고 조회는 성공한다")
    void leavesNullWhenPortIsEmpty() {
        CountingPort port = new CountingPort(Optional.empty());

        AiPlanJobInfo info = processor(new FakeStore(completedJob()), port).getJobInfo(JOB_ID, OWNER_ID);

        assertThat(info.status()).isEqualTo(AiPlanJobStatus.COMPLETED);
        assertThat(info.planDraft()).isNotNull();
        assertThat(info.committedPlanId()).isNull();
        assertThat(port.calls).isEqualTo(1);
    }

    @Test
    @DisplayName("취소 응답은 담은 일정을 묻지 않는다 — 취소된 잡은 초안이 없다")
    void cancelDoesNotLookUp() {
        CountingPort port = new CountingPort(Optional.of(COMMITTED_PLAN_ID));
        FakeStore store = new FakeStore(job(AiPlanJobStatus.RUNNING));

        AiPlanJobInfo info = new AiPlanJobProcessor(store, new NoopEvents(), null, properties(), port)
            .cancelJob(JOB_ID, OWNER_ID);

        assertThat(info.status()).isEqualTo(AiPlanJobStatus.CANCELED);
        assertThat(info.committedPlanId()).isNull();
        assertThat(port.calls).isZero();
    }

    // 픽스처 ──────────────────────────────────────────────────────────────

    /** 조회 경로는 워커·이벤트를 쓰지 않는다. 필요해지면 NPE 가 알려 준다. */
    private AiPlanJobProcessor processor(FakeStore store, PlanAiCommitQueryPort port) {
        return new AiPlanJobProcessor(store, null, null, properties(), port);
    }

    /** 타임아웃을 넉넉히 둬 expireIfStuck 이 끼어들지 않게 한다. */
    private static AiPlanJobProperties properties() {
        return new AiPlanJobProperties(600, 600, 600);
    }

    private static AiPlanJob job(AiPlanJobStatus status) {
        return AiPlanJob.builder()
            .jobId(JOB_ID).memberId(OWNER_ID).requestHash("hash")
            .status(status)
            .step(status == AiPlanJobStatus.PENDING ? null : AiPlanJobStep.DRAFTING)
            .createdAt(Instant.now())
            .startedAt(status == AiPlanJobStatus.PENDING ? null : Instant.now())
            .build();
    }

    private static AiPlanJob completedJob() {
        return job(AiPlanJobStatus.RUNNING)
            .completedWithDraft(AiPlanDraft.builder().days(List.of()).reasons(List.of()).build(), Instant.now());
    }

    private static final class CountingPort implements PlanAiCommitQueryPort {

        private final Optional<Long> answer;
        private int calls;
        private Long lastMemberId;
        private String lastJobId;

        private CountingPort(Optional<Long> answer) {
            this.answer = answer;
        }

        @Override
        public Optional<Long> findCommittedPlanId(long memberId, String jobId) {
            calls++;
            lastMemberId = memberId;
            lastJobId = jobId;
            return answer;
        }
    }

    private static final class NoopEvents implements AiPlanJobEventPort {

        @Override
        public void publishJobUpdated(String jobId) {
        }

        @Override
        public AiPlanJobSubscription subscribe(String jobId, Runnable onEvent) {
            throw new UnsupportedOperationException();
        }
    }

    private static final class FakeStore implements AiPlanJobStorePort {

        private final AiPlanJob stored;

        private FakeStore(AiPlanJob stored) {
            this.stored = stored;
        }

        @Override
        public Optional<AiPlanJob> findById(String jobId) {
            return Optional.ofNullable(stored);
        }

        @Override
        public AiPlanJob save(AiPlanJob job) {
            // 포트 계약과 같게, 종결로 저장된 잡은 덮지 않고 저장소의 잡을 돌려준다.
            return stored != null && stored.status().isTerminal() ? stored : job;
        }

        @Override
        public void releaseIdempotencyKey(Long memberId, String requestHash, String jobId) {
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
}
