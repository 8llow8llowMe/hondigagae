package com.hondigagae.domainlayer.planner.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.planner.application.exception.AiPlanErrorCode;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanException;
import com.hondigagae.domainlayer.planner.application.info.AiPlanJobInfo;
import com.hondigagae.domainlayer.planner.application.port.out.AiPlanJobStorePort;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJob;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJobStatus;
import com.hondigagae.global.properties.AiPlanJobProperties;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 조건이 실려도 노출 범위는 넓어지지 않는다 (#488).
 *
 * <p>응답에 지역·기간·반려견·메모가 실리기 시작했으므로, 남의 잡이 새면 이제 <b>존재
 * 사실만이 아니라 그 사람의 여행 계획과 메모가 함께 샌다.</b> 소유권 검사는 조건을
 * 조립하기 전에 있어야 하고, 그 순서를 누군가 뒤집으면 여기서 걸린다.
 */
class AiPlanJobConditionsExposureTest {

    private static final String JOB_ID = "job-1";
    private static final long OWNER_ID = 7L;

    @Test
    @DisplayName("남의 작업은 조건도 함께 404 다 — 메모까지 새면 안 된다")
    void hidesConditionsOfOtherMembersJob() {
        AiPlanJobProcessor processor = processor(new FakeStore(jobWithConditions()));

        assertThatThrownBy(() -> processor.getJobInfo(JOB_ID, OWNER_ID + 1))
            .isInstanceOf(AiPlanException.class)
            .hasFieldOrPropertyWithValue("errorCode", AiPlanErrorCode.JOB_NOT_FOUND);
    }

    @Test
    @DisplayName("본인 작업은 조건이 실린다")
    void carriesConditionsForOwner() {
        AiPlanJobInfo info = processor(new FakeStore(jobWithConditions())).getJobInfo(JOB_ID, OWNER_ID);

        assertThat(info.conditions()).isNotNull();
        assertThat(info.conditions().areaCode()).isEqualTo("39");
        assertThat(info.conditions().requestNote()).isEqualTo("실내 위주로");
    }

    // 픽스처 ──────────────────────────────────────────────────────────────

    /** 조회 경로는 워커·이벤트를 쓰지 않는다. 필요해지면 NPE 가 알려 준다. */
    private AiPlanJobProcessor processor(FakeStore store) {
        // 타임아웃을 넉넉히 둬 expireIfStuck 이 끼어들지 않게 한다 — 여기서 볼 것은 소유권이다.
        return new AiPlanJobProcessor(store, null, null, new AiPlanJobProperties(600, 600, 600));
    }

    private static AiPlanJob jobWithConditions() {
        Map<String, String> params = Map.of(
            "areaCode", "39", "sigunguCode", "4",
            "startDate", "2026-09-11", "endDate", "2026-09-13",
            "budget", "400000", "petIds", "1234567890123456789",
            "requestNote", "실내 위주로"
        );
        return AiPlanJob.builder()
            .jobId(JOB_ID).memberId(OWNER_ID).requestHash("hash").requestParams(params)
            .status(AiPlanJobStatus.RUNNING)
            .createdAt(Instant.now()).startedAt(Instant.now())
            .build();
    }

    private record FakeStore(AiPlanJob stored) implements AiPlanJobStorePort {

        @Override
        public Optional<AiPlanJob> findById(String jobId) {
            return Optional.ofNullable(stored);
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
