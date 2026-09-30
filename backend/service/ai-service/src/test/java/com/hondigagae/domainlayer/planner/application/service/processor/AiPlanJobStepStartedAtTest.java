package com.hondigagae.domainlayer.planner.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.planner.application.info.AiPlanJobInfo;
import com.hondigagae.domainlayer.planner.application.port.out.AiPlanJobStorePort;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJob;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJobStatus;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJobStep;
import com.hondigagae.global.properties.AiPlanJobProperties;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 현재 단계 시작 시각 {@code stepStartedAt} 의 노출 규칙 (#985).
 *
 * <p>화면은 이 값으로 "이 단계에서 n초째" 를 그린다. 흐르지 않는 시간(대기 중 · 종결)에 값이 실리면
 * 끝난 작업 위에서 경과 시간이 계속 늘어난다.
 */
class AiPlanJobStepStartedAtTest {

    private static final String JOB_ID = "job-1";
    private static final long OWNER_ID = 7L;
    private static final Instant STEP_START = Instant.parse("2026-09-30T05:03:12.345Z");

    @Test
    @DisplayName("단계에 들어갈 때마다 시각이 새 단계의 것으로 바뀐다")
    void atStepReplacesStepStartedAt() {
        Instant later = STEP_START.plusSeconds(4);
        AiPlanJob job = job(AiPlanJobStatus.RUNNING, null, null)
            .atStep(AiPlanJobStep.CONDITIONS, STEP_START)
            .atStep(AiPlanJobStep.CANDIDATES, later);

        assertThat(job.step()).isEqualTo(AiPlanJobStep.CANDIDATES);
        assertThat(job.stepStartedAt()).isEqualTo(later);
    }

    @Test
    @DisplayName("실행 중이면 현재 단계 시각을 내린다")
    void exposesStepStartedAtWhileRunning() {
        AiPlanJobInfo info = infoOf(job(AiPlanJobStatus.RUNNING, AiPlanJobStep.WEATHER, STEP_START));

        assertThat(info.stepStartedAt()).isEqualTo(STEP_START);
    }

    @Test
    @DisplayName("대기 중이면 null 이다 — 아직 단계가 없다")
    void hidesStepStartedAtWhilePending() {
        AiPlanJobInfo info = infoOf(job(AiPlanJobStatus.PENDING, null, null));

        assertThat(info.stepStartedAt()).isNull();
    }

    @Test
    @DisplayName("종결이면 저장소에 남아 있어도 null 이다 — 더 흐르는 시간이 없다")
    void hidesStepStartedAtWhenTerminal() {
        assertThat(infoOf(job(AiPlanJobStatus.COMPLETED, AiPlanJobStep.DRAFTING, STEP_START)).stepStartedAt()).isNull();
        assertThat(infoOf(job(AiPlanJobStatus.FAILED, AiPlanJobStep.CANDIDATES, STEP_START)).stepStartedAt()).isNull();
        assertThat(infoOf(job(AiPlanJobStatus.CANCELED, AiPlanJobStep.CONDITIONS, STEP_START)).stepStartedAt()).isNull();
    }

    // 픽스처 ──────────────────────────────────────────────────────────────

    private AiPlanJobInfo infoOf(AiPlanJob stored) {
        // 타임아웃을 넉넉히 둬 expireIfStuck 이 끼어들지 않게 한다.
        AiPlanJobProcessor processor = new AiPlanJobProcessor(
            new SingleJobStore(stored), null, null, new AiPlanJobProperties(600, 600, 600), (memberId, jobId) -> Optional.empty());
        return processor.getJobInfo(JOB_ID, OWNER_ID);
    }

    private static AiPlanJob job(AiPlanJobStatus status, AiPlanJobStep step, Instant stepStartedAt) {
        return AiPlanJob.builder()
            .jobId(JOB_ID).memberId(OWNER_ID).requestHash("hash").requestParams(Map.of("areaCode", "39"))
            .status(status).step(step).stepStartedAt(stepStartedAt)
            .createdAt(Instant.now()).startedAt(status == AiPlanJobStatus.PENDING ? null : Instant.now())
            .build();
    }

    private record SingleJobStore(AiPlanJob stored) implements AiPlanJobStorePort {

        @Override
        public Optional<AiPlanJob> findById(String jobId) {
            return Optional.of(stored);
        }

        @Override
        public AiPlanJob save(AiPlanJob job) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void releaseIdempotencyKey(Long memberId, String requestHash, String jobId) {
            throw new UnsupportedOperationException();
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
