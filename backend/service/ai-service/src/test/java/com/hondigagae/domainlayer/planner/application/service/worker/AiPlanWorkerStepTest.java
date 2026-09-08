package com.hondigagae.domainlayer.planner.application.service.worker;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.planner.application.model.AiPlanGenerationQuery;
import com.hondigagae.domainlayer.planner.application.model.AiPlanJobSubscription;
import com.hondigagae.domainlayer.planner.application.model.DayWeatherOutlook;
import com.hondigagae.domainlayer.planner.application.model.PackingChecklistQuery;
import com.hondigagae.domainlayer.planner.application.model.PetCondition;
import com.hondigagae.domainlayer.planner.application.model.PlanOutline;
import com.hondigagae.domainlayer.planner.application.port.out.AiLlmPort;
import com.hondigagae.domainlayer.planner.application.port.out.AiPlanJobEventPort;
import com.hondigagae.domainlayer.planner.application.port.out.AiPlanJobStorePort;
import com.hondigagae.domainlayer.planner.application.port.out.FavoritePlaceIdsQueryPort;
import com.hondigagae.domainlayer.planner.application.port.out.PetConditionQueryPort;
import com.hondigagae.domainlayer.planner.application.port.out.PlaceCandidateQueryPort;
import com.hondigagae.domainlayer.planner.application.port.out.PlanOutlineQueryPort;
import com.hondigagae.domainlayer.planner.application.port.out.WeatherOutlookQueryPort;
import com.hondigagae.domainlayer.planner.application.port.out.query.PlaceCandidateQueryResult;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJob;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJobStatus;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJobStep;
import com.hondigagae.domainlayer.planner.domain.model.PackingList;
import com.hondigagae.global.properties.AiLlmProperties;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 세부 진행 단계와 취소 (#90).
 *
 * <p>여기서 지키는 것은 셋이다.
 *
 * <ul>
 *   <li><b>단계 순서가 실제 실행 순서다</b> — {@code AiPlanJobStep} 의 선언 순서와 워커가
 *       밟는 순서가 갈라지면 화면은 정확해 보이는 채로 거짓 진행률을 그린다. 그것이 이 기능을
 *       미루던 이유라, 순서를 값으로 고정한다</li>
 *   <li><b>취소는 비싼 호출에 들어가기 전에 선다</b> — 취소의 실익이 거기 있다. LLM 호출을
 *       끊을 수는 없으니 단계 경계에서 멈추는 것이 전부다</li>
 *   <li><b>취소된 잡을 결과로 덮지 않는다</b> — 생성이 끝나 버렸다고 완료로 만들면 사용자가
 *       취소한 일정이 화면에 뜬다</li>
 * </ul>
 *
 * <p>저장소·이벤트는 상태를 들고 순서를 세야 해서 손으로 만든 fake 를 쓴다.
 */
class AiPlanWorkerStepTest {

    private static final String JOB_ID = "job-1";
    private static final long MEMBER_ID = 7L;

    @Test
    @DisplayName("단계를 선언 순서대로 밟고 화면에 알린다")
    void walksStepsInDeclarationOrder() {
        FakeJobStore store = new FakeJobStore(pendingJob(null));
        FakeJobEvents events = new FakeJobEvents();
        worker(store, events, new RecordingLlm()).runJob(JOB_ID);

        assertThat(store.observedSteps).containsExactly(AiPlanJobStep.values());
        // 단계마다 알려야 대기 화면이 진행을 그린다. RUNNING 전이 1회 + 단계 4회 + 종결 1회.
        assertThat(events.publishCount).isEqualTo(AiPlanJobStep.values().length + 2);
        assertThat(store.current().status()).isEqualTo(AiPlanJobStatus.COMPLETED);
        assertThat(store.current().step()).isEqualTo(AiPlanJobStep.DRAFTING);
    }

    @Test
    @DisplayName("실패해도 마지막으로 밟은 단계가 남는다 — 실패 지점이 진단이다")
    void keepsTheStepWhereItFailed() {
        FakeJobStore store = new FakeJobStore(pendingJob(null));
        RecordingLlm llm = new RecordingLlm();
        llm.failing = true;

        worker(store, new FakeJobEvents(), llm).runJob(JOB_ID);

        assertThat(store.current().status()).isEqualTo(AiPlanJobStatus.FAILED);
        assertThat(store.current().step()).isEqualTo(AiPlanJobStep.DRAFTING);
    }

    @Test
    @DisplayName("단계 경계에서 취소를 보면 AI 를 부르지 않고 선다")
    void stopsBeforeCallingTheModelWhenCanceled() {
        // 취소의 실익이 여기다. DRAFTING 이 수십 초라 그 앞에서 서야 아끼는 것이 있다.
        FakeJobStore store = new FakeJobStore(pendingJob(null));
        store.cancelBefore = AiPlanJobStep.CANDIDATES;
        RecordingLlm llm = new RecordingLlm();

        worker(store, new FakeJobEvents(), llm).runJob(JOB_ID);

        assertThat(llm.calls).isZero();
        assertThat(store.current().status()).isEqualTo(AiPlanJobStatus.CANCELED);
        assertThat(store.observedSteps).containsExactly(AiPlanJobStep.CONDITIONS);
    }

    @Test
    @DisplayName("생성 도중 취소됐으면 돌아온 초안을 버린다")
    void discardsTheDraftWhenCanceledDuringGeneration() {
        // AI 호출은 중간에 끊을 수 없다. 결과를 버리는 것까지가 할 수 있는 전부인데,
        // 그것마저 안 하면 사용자가 취소한 일정이 완료로 뜬다.
        FakeJobStore store = new FakeJobStore(pendingJob(null));
        RecordingLlm llm = new RecordingLlm();
        llm.onCall = () -> store.forceStatus(AiPlanJobStatus.CANCELED);

        worker(store, new FakeJobEvents(), llm).runJob(JOB_ID);

        assertThat(llm.calls).isEqualTo(1);
        assertThat(store.current().status()).isEqualTo(AiPlanJobStatus.CANCELED);
        assertThat(store.current().planDraft()).isNull();
    }

    @Test
    @DisplayName("생성 도중 타임아웃 판정(FAILED)된 잡을 완료로 되살리지 않는다")
    void doesNotResurrectTimedOutJobWithDraft() {
        // 폴링 쪽 expireIfStuck 이 RUNNING 타임아웃으로 FAILED 를 박고 멱등 키를 풀었을 수 있다.
        // 그 위에 COMPLETED 를 덮으면 사용자가 이미 재제출한 동일 요청과 결과가 둘이 된다.
        FakeJobStore store = new FakeJobStore(pendingJob(null));
        RecordingLlm llm = new RecordingLlm();
        llm.onCall = () -> store.forceStatus(AiPlanJobStatus.FAILED);

        worker(store, new FakeJobEvents(), llm).runJob(JOB_ID);

        assertThat(store.current().status()).isEqualTo(AiPlanJobStatus.FAILED);
        assertThat(store.current().planDraft()).isNull();
    }

    @Test
    @DisplayName("시군구를 지정하면 후보 조회에 그대로 넘긴다")
    void passesSigunguCodeToCandidateLookup() {
        FakeJobStore store = new FakeJobStore(pendingJob("4"));
        RecordingCandidates candidates = new RecordingCandidates();

        worker(store, new FakeJobEvents(), new RecordingLlm(), candidates).runJob(JOB_ID);

        assertThat(candidates.requestedSigunguCode).isEqualTo("4");
    }

    @Test
    @DisplayName("시군구를 비우면 null 로 넘긴다 — 빈 문자열은 빈 시군구로 걸러질 수 있다")
    void passesNullWhenSigunguCodeIsBlank() {
        FakeJobStore store = new FakeJobStore(pendingJob(""));
        RecordingCandidates candidates = new RecordingCandidates();

        worker(store, new FakeJobEvents(), new RecordingLlm(), candidates).runJob(JOB_ID);

        assertThat(candidates.requestedSigunguCode).isNull();
    }

    // 픽스처 ──────────────────────────────────────────────────────────────

    private AiPlanWorker worker(FakeJobStore store, FakeJobEvents events, RecordingLlm llm) {
        return worker(store, events, llm, new RecordingCandidates());
    }

    private AiPlanWorker worker(
        FakeJobStore store, FakeJobEvents events, RecordingLlm llm, RecordingCandidates candidates
    ) {
        return new AiPlanWorker(
            store, events, llm, candidates,
            new StubPetConditions(), new StubPlanOutlines(), new StubFavorites(), new StubWeather(),
            new AiLlmProperties(null, null, null, null, null, null, null, null, null, null));
    }

    private static AiPlanJob pendingJob(String sigunguCode) {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("areaCode", "39");
        params.put("sigunguCode", sigunguCode == null ? "" : sigunguCode);
        params.put("startDate", "2026-09-12");
        params.put("endDate", "2026-09-13");
        params.put("budget", "");
        params.put("petIds", "");
        params.put("pinnedPlaceIds", "");
        params.put("preferFavorites", "false");
        params.put("planId", "");
        params.put("regenerateDay", "");
        params.put("requestNote", "");

        return AiPlanJob.builder()
            .jobId(JOB_ID)
            .memberId(MEMBER_ID)
            .requestHash("hash")
            .requestParams(params)
            .status(AiPlanJobStatus.PENDING)
            .createdAt(Instant.now())
            .build();
    }

    /** 저장된 잡을 들고 있으면서 밟은 단계를 순서대로 기록한다. */
    private static final class FakeJobStore implements AiPlanJobStorePort {

        private AiPlanJob job;
        private final List<AiPlanJobStep> observedSteps = new ArrayList<>();
        /** 이 단계에 들어가려는 순간 취소된 것으로 만든다. 다른 인스턴스의 취소를 흉내 낸다. */
        private AiPlanJobStep cancelBefore;

        private FakeJobStore(AiPlanJob job) {
            this.job = job;
        }

        private AiPlanJob current() {
            return job;
        }

        private void forceStatus(AiPlanJobStatus status) {
            if (status == AiPlanJobStatus.CANCELED) {
                job = job.canceled(Instant.now());
            } else if (status == AiPlanJobStatus.FAILED) {
                job = job.failed("AIPLAN_006", "timeout", Instant.now());
            }
        }

        @Override
        public Optional<AiPlanJob> findById(String jobId) {
            if (cancelBefore != null && nextStepOf(job) == cancelBefore) {
                forceStatus(AiPlanJobStatus.CANCELED);
                cancelBefore = null;
            }
            return Optional.of(job);
        }

        /** 다음에 밟을 단계. 기록된 마지막 단계의 다음이다. */
        private AiPlanJobStep nextStepOf(AiPlanJob current) {
            int nextIndex = current.step() == null ? 0 : current.step().ordinal() + 1;
            AiPlanJobStep[] steps = AiPlanJobStep.values();
            return nextIndex < steps.length ? steps[nextIndex] : null;
        }

        @Override
        public AiPlanJob save(AiPlanJob saving) {
            // 포트 계약과 같게, 종결로 저장된 잡은 덮지 않고 저장소의 잡을 돌려준다 —
            // "취소·타임아웃된 잡을 결과로 되살리지 않는다" 가 이 계약 위에 서 있다.
            if (job.status().isTerminal()) {
                return job;
            }
            if (saving.step() != null && !Objects.equals(saving.step(), job.step())) {
                observedSteps.add(saving.step());
            }
            job = saving;
            return saving;
        }

        @Override
        public Optional<String> reserveOrGetExistingJobId(Long memberId, String requestHash, String newJobId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void releaseIdempotencyKey(Long memberId, String requestHash, String jobId) {
            // 워커가 finally 에서 항상 부른다. 이 테스트의 관심사는 아니다.
        }

        @Override
        public void deleteJob(String jobId) {
            throw new UnsupportedOperationException();
        }
    }

    private static final class FakeJobEvents implements AiPlanJobEventPort {

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

    private static final class RecordingLlm implements AiLlmPort {

        private int calls;
        private boolean failing;
        private Runnable onCall;

        @Override
        public AiPlanDraft generatePlanDraft(AiPlanGenerationQuery query) {
            calls++;
            if (onCall != null) {
                onCall.run();
            }
            if (failing) {
                throw new IllegalStateException("model exploded");
            }
            return AiPlanDraft.builder().days(List.of()).reasons(List.of()).build();
        }

        @Override
        public PackingList generatePackingList(PackingChecklistQuery query) {
            throw new UnsupportedOperationException();
        }
    }

    private static final class RecordingCandidates implements PlaceCandidateQueryPort {

        private String requestedSigunguCode;
        private boolean captured;

        @Override
        public List<PlaceCandidateQueryResult> findPetFriendlyCandidates(String areaCode, String sigunguCode, int size) {
            requestedSigunguCode = sigunguCode;
            captured = true;
            return List.of(PlaceCandidateQueryResult.builder()
                .placeId(100L).title("후보").lat(33.5).lng(126.5)
                .build());
        }

        @Override
        public List<PlaceCandidateQueryResult> findCandidatesByIds(List<Long> placeIds) {
            return List.of();
        }
    }

    private static final class StubPetConditions implements PetConditionQueryPort {

        @Override
        public List<PetCondition> findConditions(long memberId, List<Long> petIds) {
            return List.of();
        }

        @Override
        public Optional<PetCondition> findRepresentativeCondition(long memberId) {
            return Optional.of(PetCondition.builder().sizeName("소형견").build());
        }
    }

    private static final class StubPlanOutlines implements PlanOutlineQueryPort {

        @Override
        public Optional<PlanOutline> findOutline(long memberId, long planId) {
            throw new UnsupportedOperationException();
        }
    }

    private static final class StubFavorites implements FavoritePlaceIdsQueryPort {

        @Override
        public List<Long> findFavoritePlaceIds(long memberId) {
            throw new UnsupportedOperationException();
        }
    }

    private static final class StubWeather implements WeatherOutlookQueryPort {

        @Override
        public List<DayWeatherOutlook> findDailyOutlook(String areaCode) {
            return List.of();
        }
    }
}
