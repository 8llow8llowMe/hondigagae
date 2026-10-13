package com.hondigagae.domainlayer.planner.application.service.worker;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.planner.application.exception.AiPlanErrorCode;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanException;
import com.hondigagae.domainlayer.planner.application.model.AiPlanGenerationQuery;
import com.hondigagae.domainlayer.planner.application.model.AiPlanJobMode;
import com.hondigagae.domainlayer.planner.application.model.AiPlanStepOutcome;
import com.hondigagae.domainlayer.planner.application.model.AiPlanJobSubscription;
import com.hondigagae.domainlayer.planner.application.model.DayWeatherOutlook;
import com.hondigagae.domainlayer.planner.application.model.JejuZone;
import com.hondigagae.domainlayer.planner.application.model.PackingChecklistQuery;
import com.hondigagae.domainlayer.planner.application.model.PetAdmission;
import com.hondigagae.domainlayer.planner.application.model.PetCondition;
import com.hondigagae.domainlayer.planner.application.model.PlaceCandidate;
import com.hondigagae.domainlayer.planner.application.model.PlanOutline;
import com.hondigagae.domainlayer.planner.application.service.CandidateZonePolicy;
import com.hondigagae.domainlayer.planner.application.service.CandidateZonePolicy.Kind;
import com.hondigagae.domainlayer.planner.application.port.out.AiLlmPort;
import com.hondigagae.domainlayer.planner.application.port.out.AiPlanJobEventPort;
import com.hondigagae.domainlayer.planner.application.port.out.AiPlanJobMetricsPort;
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
import com.hondigagae.shared.travel.pet.PetSizeType;
import com.hondigagae.shared.travel.place.AllowedPetSize;
import com.hondigagae.shared.travel.plan.PlanItemType;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
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

    private final RecordingMetrics metrics = new RecordingMetrics();

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

    @Test
    @DisplayName("단계에 들어갈 때마다 시작 시각을 새로 적는다 — 종결 뒤에도 마지막 단계 시각이 저장소에 남는다")
    void stampsStepStartedAtOnEveryTransition() {
        FakeJobStore store = new FakeJobStore(pendingJob(null));
        Instant before = Instant.now();

        worker(store, new FakeJobEvents(), new RecordingLlm()).runJob(JOB_ID);

        assertThat(store.observedStepStarts).hasSize(AiPlanJobStep.total()).doesNotContainNull()
            .allSatisfy(start -> assertThat(start).isAfterOrEqualTo(before));
        assertThat(store.observedStepStarts).isSortedAccordingTo(Instant::compareTo);
        assertThat(store.current().stepStartedAt()).isEqualTo(store.observedStepStarts.getLast());
    }

    // 요청 문구의 실내 · 카페 (#1170) ───────────────────────────────────────

    /** dev 실측 일정 "몽과 제주 2박 3일" 의 요청 문구 그대로. */
    private static final String MEASURED_NOTE = "오전엔 바다 보며 산책하고 오후엔 실내 카페에서 쉬고 싶어요";

    @Test
    @DisplayName("실내 카페 요청이면 그 조건으로 더 찾아 후보 맨 앞에 둔다")
    void reservesRequestedIndoorCafeAtTheFront() {
        AiPlanJob job = pendingJob(null);
        job.requestParams().put("requestNote", MEASURED_NOTE);
        RecordingCandidates candidates = new RecordingCandidates();
        candidates.requested = List.of(place(200L, "바다뷰 카페", "음식점", true, "카페"));
        RecordingLlm llm = new RecordingLlm();

        worker(new FakeJobStore(job), new FakeJobEvents(), llm, candidates).runJob(JOB_ID);

        assertThat(candidates.requestedIndoor).isTrue();
        assertThat(candidates.requestedCategory).isEqualTo("카페");
        assertThat(llm.lastQuery.safeCandidates()).extracting(PlaceCandidate::placeId).containsExactly(200L, 100L);
        assertThat(llm.lastQuery.requestNote()).isEqualTo(MEASURED_NOTE);
    }

    @Test
    @DisplayName("실내 요청에 걸린 숙소는 앞자리를 차지하지 않는다 — 숙소는 실내 휴식 요청을 대신하지 않는다")
    void doesNotReserveLodgingForIndoorRequest() {
        AiPlanJob job = pendingJob(null);
        job.requestParams().put("requestNote", "비 오면 실내에서 쉬고 싶어요");
        RecordingCandidates candidates = new RecordingCandidates();
        candidates.requested = List.of(
            place(300L, "포시즌펜션", "숙박", true, "펜션"),
            place(301L, "제주도립미술관", "문화시설", true, null));
        RecordingLlm llm = new RecordingLlm();

        worker(new FakeJobStore(job), new FakeJobEvents(), llm, candidates).runJob(JOB_ID);

        assertThat(candidates.requestedIndoor).isTrue();
        assertThat(candidates.requestedCategory).isNull();
        assertThat(llm.lastQuery.safeCandidates()).extracting(PlaceCandidate::placeId).containsExactly(301L, 100L);
    }

    @Test
    @DisplayName("맞는 후보가 없으면 생성은 끝내고 근거 맨 앞에서 없다고 말한다")
    void disclosesUnmetRequestWithoutFailing() {
        AiPlanJob job = pendingJob(null);
        job.requestParams().put("requestNote", MEASURED_NOTE);
        FakeJobStore store = new FakeJobStore(job);

        worker(store, new FakeJobEvents(), new RecordingLlm(), new RecordingCandidates()).runJob(JOB_ID);

        assertThat(store.current().status()).isEqualTo(AiPlanJobStatus.COMPLETED);
        assertThat(store.current().planDraft().reasons()).first()
            .satisfies(reason -> {
                assertThat(reason.code()).isEqualTo("REQUEST_UNMET");
                assertThat(reason.description()).isEqualTo("요청하신 실내 카페가 이번 후보에 없어요.");
            });
    }

    @Test
    @DisplayName("후보에 맞는 곳이 있으면 초안에서 빠진 날에 넣고 근거 맨 앞에서 넣었다고 말한다 (#1423)")
    void fillsTheRequestedPlaceIntoTheDraft() {
        AiPlanJob job = pendingJob(null);
        job.requestParams().put("requestNote", MEASURED_NOTE);
        FakeJobStore store = new FakeJobStore(job);
        RecordingCandidates candidates = new RecordingCandidates();
        candidates.requested = List.of(place(200L, "바다뷰 카페", "음식점", true, "카페"));
        RecordingLlm llm = new RecordingLlm();
        // 모델은 일반 후보(100) 하나만 골랐다 — 후보 풀에 실내 카페가 있어도 초안에는 없다
        llm.draft = AiPlanDraft.builder()
            .days(List.of(AiPlanDraft.AiPlanDraftDay.builder().day(1).items(List.of(AiPlanDraft.AiPlanDraftItem.builder()
                .itemType(PlanItemType.PLACE).placeId(100L).title("후보").note("바다를 보며 걸어요.").build())).build()))
            .reasons(List.of())
            .build();

        worker(store, new FakeJobEvents(), llm, candidates).runJob(JOB_ID);

        AiPlanDraft saved = store.current().planDraft();
        assertThat(saved.days().get(0).items()).extracting(AiPlanDraft.AiPlanDraftItem::placeId).containsExactly(100L, 200L);
        assertThat(saved.reasons()).first().satisfies(reason -> {
            assertThat(reason.code()).isEqualTo("REQUEST_APPLIED");
            assertThat(reason.description()).isEqualTo("요청하신 실내 카페를 넣었어요.");
        });
    }

    @Test
    @DisplayName("실내 · 카페가 없는 요청은 추가 검색을 하지 않는다")
    void skipsRequestedLookupWithoutIndoorOrCafe() {
        AiPlanJob job = pendingJob(null);
        job.requestParams().put("requestNote", "바다 보며 산책하고 싶어요");
        RecordingCandidates candidates = new RecordingCandidates();

        worker(new FakeJobStore(job), new FakeJobEvents(), new RecordingLlm(), candidates).runJob(JOB_ID);

        assertThat(candidates.requestedLookups).isZero();
    }

    // 숙박 권역 할당 (#1236) ─────────────────────────────────────────────────

    @Test
    @DisplayName("동반 가능 숙박을 권역마다 찾아 후보 뒤에 싣는다 — 지역 검색 상위 N 에는 숙박이 우연히만 든다")
    void spreadsLodgingByZone() {
        AiPlanJob job = pendingJob("4");
        RecordingCandidates candidates = new RecordingCandidates();
        candidates.stays = List.of(
            stay(501L, "포시즌펜션", 33.2480, 126.5650),
            stay(502L, "중문 펜션", 33.2500, 126.4100));
        RecordingLlm llm = new RecordingLlm();

        worker(new FakeJobStore(job), new FakeJobEvents(), llm, candidates).runJob(JOB_ID);

        assertThat(candidates.lodgingSigunguCode).isEqualTo("4");
        assertThat(llm.lastQuery.safeCandidates()).extracting(PlaceCandidate::placeId)
            .containsExactly(100L, 501L, 502L);
    }

    @Test
    @DisplayName("숙박 조회가 실패해도 생성은 계속한다 — 숙박은 동선을 낫게 할 뿐이다")
    void continuesWhenLodgingLookupFails() {
        AiPlanJob job = pendingJob(null);
        FakeJobStore store = new FakeJobStore(job);
        RecordingCandidates candidates = new RecordingCandidates();
        candidates.lodgingFailure = new AiPlanException(AiPlanErrorCode.INTERNAL_SERVICE_UNAVAILABLE);
        RecordingLlm llm = new RecordingLlm();

        worker(store, new FakeJobEvents(), llm, candidates).runJob(JOB_ID);

        assertThat(store.current().status()).isEqualTo(AiPlanJobStatus.COMPLETED);
        assertThat(llm.lastQuery.safeCandidates()).extracting(PlaceCandidate::placeId).containsExactly(100L);
    }

    // 음식점 권역 할당 · 요청 카페 권역 순환 (#1245) ──────────────────────────────

    @Test
    @DisplayName("숙박 다음에 동반 가능 음식점도 권역마다 찾아 싣는다 — 숙박 조회가 실패해도 음식점은 싣는다")
    void spreadsRestaurantsEvenWhenLodgingFails() {
        AiPlanJob job = pendingJob(null);
        RecordingCandidates candidates = new RecordingCandidates();
        candidates.lodgingFailure = new AiPlanException(AiPlanErrorCode.INTERNAL_SERVICE_UNAVAILABLE);
        candidates.restaurants = List.of(
            restaurant(701L, "중문 식당", 33.2500, 126.4100),
            restaurant(702L, "애월 식당", 33.4600, 126.3100));
        RecordingLlm llm = new RecordingLlm();

        worker(new FakeJobStore(job), new FakeJobEvents(), llm, candidates).runJob(JOB_ID);

        assertThat(llm.lastQuery.safeCandidates()).extracting(PlaceCandidate::placeId)
            .containsExactly(100L, 701L, 702L);
    }

    @Test
    @DisplayName("실내 카페 요청 후보를 넉넉히 가져와 권역을 돌아가며 앞에 둔다 — placeId 순 앞 8곳은 북서부에 몰렸다")
    void picksRequestedCafesAcrossZones() {
        AiPlanJob job = pendingJob(null);
        job.requestParams().put("requestNote", MEASURED_NOTE);
        RecordingCandidates candidates = new RecordingCandidates();
        candidates.requested = List.of(
            restaurant(801L, "당당", 33.4600, 126.3100),
            restaurant(802L, "애월더선셋", 33.4700, 126.3300),
            restaurant(803L, "중문 카페", 33.2400, 126.4000));
        RecordingLlm llm = new RecordingLlm();

        worker(new FakeJobStore(job), new FakeJobEvents(), llm, candidates).runJob(JOB_ID);

        assertThat(candidates.requestedSize).isEqualTo(50);
        assertThat(llm.lastQuery.safeCandidates()).extracting(PlaceCandidate::placeId)
            .containsExactly(801L, 803L, 802L, 100L);
    }

    // 권역 대표점 거리순 후보 (#1312) ─────────────────────────────────────────

    @Test
    @DisplayName("제주 전체 요청이면 id 순 일반 후보에 남동부가 없어도 거리순 조회로 남동부 방문 · 숙박 · 음식점을 하한만큼 싣고 상한 50을 지킨다")
    void fillsSouthEastFromAnchoredLookupsWithinLimit() {
        RecordingCandidates candidates = southEastReady();
        RecordingLlm llm = new RecordingLlm();

        worker(new FakeJobStore(pendingJob(null)), new FakeJobEvents(), llm, candidates).runJob(JOB_ID);

        List<PlaceCandidate> pool = llm.lastQuery.safeCandidates();
        assertThat(pool).hasSize(50);
        assertThat(candidates.nearbyLookups).isEqualTo(18);
        assertThat(pool).extracting(PlaceCandidate::placeId)
            .contains(901L, 902L, 903L, 911L, 912L, 921L, 922L)
            .doesNotContain(904L, 905L, 913L, 923L);
        // 북부 일반 후보의 꼬리가 권역 몫만큼(방문 3 · 숙박 2 · 음식점 2) 빠졌다
        assertThat(pool).filteredOn(candidate -> candidate.placeId() <= 50L).hasSize(43);
    }

    @Test
    @DisplayName("시군구를 지정하거나 하루 재생성이면 거리순 조회를 하지 않는다 — 기존 동작 그대로다")
    void skipsAnchoredLookupsForSigunguOrRegeneration() {
        RecordingCandidates sigungu = southEastReady();
        worker(new FakeJobStore(pendingJob("4")), new FakeJobEvents(), new RecordingLlm(), sigungu).runJob(JOB_ID);
        assertThat(sigungu.nearbyLookups).isZero();

        AiPlanJob regenerate = pendingJob(null);
        regenerate.requestParams().put("regenerateDay", "2");
        RecordingCandidates regenerated = southEastReady();
        worker(new FakeJobStore(regenerate), new FakeJobEvents(), new RecordingLlm(), regenerated).runJob(JOB_ID);
        assertThat(regenerated.nearbyLookups).isZero();
    }

    @Test
    @DisplayName("제주가 아닌 지역은 거리순 조회를 하지 않는다 — 권역이 없다")
    void skipsAnchoredLookupsOutsideJeju() {
        AiPlanJob seoul = pendingJob(null);
        seoul.requestParams().put("areaCode", "1");
        RecordingCandidates candidates = southEastReady();

        worker(new FakeJobStore(seoul), new FakeJobEvents(), new RecordingLlm(), candidates).runJob(JOB_ID);

        assertThat(candidates.nearbyLookups).isZero();
    }

    @Test
    @DisplayName("거리순 조회가 한 번 실패하면 남은 조회를 건너뛰고 id 순 결과로 이어 간다 — 서킷에 실패를 더 쌓지 않는다")
    void stopsAnchoredLookupsOnFirstFailure() {
        RecordingCandidates candidates = southEastReady();
        candidates.nearbyVisitFailure = new AiPlanException(AiPlanErrorCode.INTERNAL_SERVICE_UNAVAILABLE);
        candidates.stays = List.of(located(931L, "숙박", 33.3050, 126.7700));
        FakeJobStore store = new FakeJobStore(pendingJob(null));
        RecordingLlm llm = new RecordingLlm();

        worker(store, new FakeJobEvents(), llm, candidates).runJob(JOB_ID);

        assertThat(store.current().status()).isEqualTo(AiPlanJobStatus.COMPLETED);
        assertThat(candidates.nearbyLookups).isEqualTo(1);
        assertThat(llm.lastQuery.safeCandidates()).hasSize(50).extracting(PlaceCandidate::placeId)
            .contains(931L)
            .doesNotContain(901L, 911L, 921L);
    }

    @Test
    @DisplayName("거리순 조회의 누적 시간이 예산(3초)을 넘으면 남은 조회를 부르지 않는다")
    void stopsAnchoredLookupsWhenBudgetIsSpent() {
        RecordingCandidates candidates = southEastReady();
        AiPlanWorker worker = worker(new FakeJobStore(pendingJob(null)), new FakeJobEvents(), new RecordingLlm(), candidates);
        // 시계를 볼 때마다 1초씩 흐른다 — 시작 0초, 1 · 2초에 부르고 3초에 멈춘다
        long[] ticks = {0};
        worker.nanoClock = () -> Duration.ofSeconds(ticks[0]++).toNanos();

        worker.runJob(JOB_ID);

        assertThat(candidates.nearbyLookups).isEqualTo(2);
    }

    @Test
    @DisplayName("id 순 숙박과 거리순 숙박이 같은 곳이면 한 번만 싣는다")
    void dedupesLodgingFoundByBothLookups() {
        RecordingCandidates candidates = southEastReady();
        candidates.stays = List.of(located(911L, "숙박", 33.3300, 126.8000));
        RecordingLlm llm = new RecordingLlm();

        worker(new FakeJobStore(pendingJob(null)), new FakeJobEvents(), llm, candidates).runJob(JOB_ID);

        assertThat(llm.lastQuery.safeCandidates()).filteredOn(candidate -> candidate.placeId() == 911L).hasSize(1);
        assertThat(llm.lastQuery.safeCandidates()).hasSize(50);
    }

    @Test
    @DisplayName("6권역 모두 거리순 결과가 있고 카페 요청이 있으면 풀 50곳에 요청 후보 8곳을 지키고 권역마다 방문 3 · 숙박 2 · 음식점 2곳을 싣는다")
    void balancesEveryZoneWithRequestedCafes() {
        AiPlanJob job = pendingJob(null);
        job.requestParams().put("requestNote", "카페 가고 싶어요");
        RecordingCandidates candidates = southEastReady();
        List<PlaceCandidateQueryResult> requested = new ArrayList<>();
        long id = 1_000L;
        for (JejuZone zone : JejuZone.values()) {
            double lat = zone.getAnchorLat();
            double lng = zone.getAnchorLng();
            requested.add(restaurant(id++, "요청 카페", lat + 0.001, lng + 0.001));
            requested.add(restaurant(id++, "요청 카페", lat + 0.002, lng + 0.002));
            candidates.nearbyVisits.put(zone, List.of(
                located(id++, "관광지", lat, lng), located(id++, "관광지", lat + 0.003, lng),
                located(id++, "관광지", lat, lng + 0.003), located(id++, "관광지", lat + 0.004, lng)));
            candidates.nearbyLodgings.put(zone, List.of(
                located(id++, "숙박", lat - 0.001, lng), located(id++, "숙박", lat - 0.002, lng),
                located(id++, "숙박", lat - 0.003, lng)));
            candidates.nearbyRestaurants.put(zone, List.of(
                located(id++, "음식점", lat, lng - 0.001), located(id++, "음식점", lat, lng - 0.002),
                located(id++, "음식점", lat, lng - 0.003)));
        }
        candidates.requested = requested;
        RecordingLlm llm = new RecordingLlm();

        worker(new FakeJobStore(job), new FakeJobEvents(), llm, candidates).runJob(JOB_ID);

        List<PlaceCandidate> pool = llm.lastQuery.safeCandidates();
        assertThat(pool).hasSize(50);
        // 요청 카페는 권역을 돌아가며 8곳이 앞에 있다 — 꼬리 깎기에 깎이지 않는다
        assertThat(pool.subList(0, 8)).allSatisfy(candidate -> assertThat(candidate.title()).isEqualTo("요청 카페"));
        for (JejuZone zone : JejuZone.values()) {
            List<PlaceCandidate> inZone = pool.stream()
                .filter(candidate -> JejuZone.of(candidate.lat(), candidate.lng()) == zone).toList();
            assertThat(inZone).as("%s 방문", zone).filteredOn(CandidateZonePolicy::isVisit).hasSizeGreaterThanOrEqualTo(3);
            assertThat(inZone).as("%s 숙박", zone).filteredOn(Kind.LODGING::matches).hasSize(2);
            assertThat(inZone).as("%s 음식점", zone).filteredOn(Kind.RESTAURANT::matches).hasSize(2);
        }
    }

    // 요청 지역 (#1423) ──────────────────────────────────────────────────

    @Test
    @DisplayName("제주 전체 요청에 지역을 적으면 맞닿은 권역 밖 후보를 빼고 요청 권역을 거리순 결과로 채운다 — 새 조회는 없다")
    void focusesThePoolOnTheRequestedRegion() {
        AiPlanJob job = pendingJob(null);
        job.requestParams().put("requestNote", "성산 쪽 위주로 다니고 싶어요");
        RecordingCandidates candidates = northEastFocusReady();
        RecordingLlm llm = new RecordingLlm();

        worker(new FakeJobStore(job), new FakeJobEvents(), llm, candidates).runJob(JOB_ID);

        List<PlaceCandidate> pool = llm.lastQuery.safeCandidates();
        assertThat(candidates.nearbyLookups).isEqualTo(18);
        // 남서부(성산의 맞닿은 권역 밖)는 하나도 남지 않는다
        assertThat(pool).noneSatisfy(candidate ->
            assertThat(JejuZone.of(candidate.lat(), candidate.lng())).isEqualTo(JejuZone.SOUTH_WEST));
        List<PlaceCandidate> northEast = pool.stream()
            .filter(candidate -> JejuZone.of(candidate.lat(), candidate.lng()) == JejuZone.NORTH_EAST).toList();
        assertThat(northEast).filteredOn(CandidateZonePolicy::isVisit).hasSize(CandidateZonePolicy.FOCUS_VISITS_PER_ZONE);
        assertThat(northEast).filteredOn(Kind.RESTAURANT::matches).hasSize(CandidateZonePolicy.FOCUS_RESTAURANTS_PER_ZONE);
        assertThat(northEast).filteredOn(Kind.LODGING::matches).hasSize(CandidateZonePolicy.FOCUS_LODGINGS_PER_ZONE);
        // 북부 일반 후보 25곳은 맞닿은 권역이라 남는다 — 25 + 북동부 14
        assertThat(pool).hasSize(39);
    }

    @Test
    @DisplayName("필수 포함 장소는 요청 지역의 맞닿은 권역 밖이어도 남는다 — 지역으로 좁힌 뒤에 합친다 (#1423)")
    void keepsPinnedPlaceOutsideTheRequestedRegion() {
        AiPlanJob job = pendingJob(null);
        job.requestParams().put("requestNote", "성산 쪽 위주로 다니고 싶어요");
        job.requestParams().put("pinnedPlaceIds", "777");
        RecordingCandidates candidates = northEastFocusReady();
        candidates.byIds = List.of(located(777L, "관광지", 33.2500, 126.3600));
        RecordingLlm llm = new RecordingLlm();

        worker(new FakeJobStore(job), new FakeJobEvents(), llm, candidates).runJob(JOB_ID);

        List<PlaceCandidate> pool = llm.lastQuery.safeCandidates();
        assertThat(pool.get(0).placeId()).isEqualTo(777L);
        assertThat(JejuZone.of(pool.get(0).lat(), pool.get(0).lng())).isEqualTo(JejuZone.SOUTH_WEST);
        // 남서부 일반 후보는 빠지고 필수 포함 하나만 남서부다
        assertThat(pool).filteredOn(candidate -> JejuZone.of(candidate.lat(), candidate.lng()) == JejuZone.SOUTH_WEST)
            .extracting(PlaceCandidate::placeId).containsExactly(777L);
        assertThat(pool).hasSize(40);
    }

    @Test
    @DisplayName("요청 지역이 풀을 좁히면 실내 · 카페 요청 후보는 맞닿은 권역 안을 먼저 고르고 모자라면 밖에서 채운다 (#1423)")
    void picksRequestedCafesWithinTheRequestedRegionFirst() {
        AiPlanJob job = pendingJob(null);
        job.requestParams().put("requestNote", "성산 쪽에서 카페 가고 싶어요");
        RecordingCandidates candidates = new RecordingCandidates();
        candidates.requested = List.of(
            restaurant(801L, "당당", 33.4600, 126.3100),
            restaurant(803L, "성산 카페", 33.4500, 126.9200));
        RecordingLlm llm = new RecordingLlm();

        worker(new FakeJobStore(job), new FakeJobEvents(), llm, candidates).runJob(JOB_ID);

        // 성산 카페(북동부)가 앞이고, 8곳에 모자라 북서부 카페도 뒤에 든다. 방문 장소가 모자라 풀 자체는 좁히지 않았다
        assertThat(llm.lastQuery.safeCandidates()).extracting(PlaceCandidate::placeId).containsExactly(803L, 801L, 100L);
    }

    @Test
    @DisplayName("부정된 카페 요청(\"카페 말고 바다 위주로\")은 요청 조건 검색을 하지 않는다 (#1423)")
    void skipsRequestedLookupWhenTheCafeIsNegated() {
        AiPlanJob job = pendingJob(null);
        job.requestParams().put("requestNote", "카페 말고 바다 위주로");
        RecordingCandidates candidates = new RecordingCandidates();

        worker(new FakeJobStore(job), new FakeJobEvents(), new RecordingLlm(), candidates).runJob(JOB_ID);

        assertThat(candidates.requestedLookups).isZero();
    }

    @Test
    @DisplayName("하루 재생성이면 요청 문구의 지역을 읽지 않는다 — 기존 일정이 앞뒤 동선을 정한다 (#1423)")
    void ignoresRequestedRegionOnRegeneration() {
        AiPlanJob job = pendingJob(null);
        job.requestParams().put("requestNote", "성산 쪽에서 카페 가고 싶어요");
        job.requestParams().put("regenerateDay", "2");
        job.requestParams().put("planId", "7");
        RecordingCandidates candidates = new RecordingCandidates();
        candidates.requested = List.of(
            restaurant(801L, "당당", 33.4600, 126.3100),
            restaurant(803L, "성산 카페", 33.4500, 126.9200));
        RecordingLlm llm = new RecordingLlm();

        worker(new FakeJobStore(job), new FakeJobEvents(), llm, candidates).runJob(JOB_ID);

        assertThat(llm.lastQuery.safeCandidates()).extracting(PlaceCandidate::placeId).containsExactly(801L, 803L, 100L);
    }

    // 동행견 입장 판정 (#1420) ────────────────────────────────────────────

    /**
     * 운영 사례 — 보리(웰시코기 · 중형견 · 체중 미상) + 몽실이(말티즈 · 소형견 3.2kg). 이 일정 3일차에 한림공원(소형견만 ·
     * "7kg 이하")이 들어갔다. 가장 제약이 큰 아이 기준이라 중형견 · 10kg(체중 미상 보리의 중형견 하한)으로 판정한다.
     */
    private static final List<PetCondition> BORI_AND_MONGSIL = List.of(
        PetCondition.builder().breed("웰시코기").sizeName("중형견").sizeType(PetSizeType.MEDIUM).build(),
        PetCondition.builder().breed("말티즈").sizeName("소형견").sizeType(PetSizeType.SMALL).weightText("3.2")
            .weightKg(new BigDecimal("3.2")).build());

    @Test
    @DisplayName("후보 검색마다 동행견 중 가장 큰 크기 · 가장 무거운 체중을 입장 기준으로 싣는다 — 권역 거리순 조회까지 (#1420)")
    void passesPetAdmissionToEverySearch() {
        AiPlanJob job = pendingJob(null);
        job.requestParams().put("petIds", "1,2");
        job.requestParams().put("requestNote", MEASURED_NOTE);
        RecordingCandidates candidates = southEastReady();
        StubPetConditions pets = new StubPetConditions();
        pets.conditions = BORI_AND_MONGSIL;

        worker(new FakeJobStore(job), new FakeJobEvents(), new RecordingLlm(), candidates, pets, new StubFavorites()).runJob(JOB_ID);

        assertThat(candidates.admissions).containsOnlyKeys(
            "findPetFriendlyCandidates", "findRequestedCandidates", "findNearbyCandidates", "findNearbyRestaurantCandidates",
            "findNearbyLodgingCandidates", "findLodgingCandidates", "findRestaurantCandidates");
        // 체중 미상 보리의 중형견 하한 10kg 이 몽실이 3.2kg 보다 무겁다
        assertThat(candidates.admissions.values()).allSatisfy(seen -> assertThat(seen).allSatisfy(admission -> {
            assertThat(admission.sizeType()).isEqualTo(PetSizeType.MEDIUM);
            assertThat(admission.weightKg()).isEqualByComparingTo("10");
        }));
        assertThat(candidates.admissions.get("findNearbyCandidates")).hasSize(JejuZone.values().length);
    }

    @Test
    @DisplayName("동행견이 들어갈 수 없는 즐겨찾기는 후보에서 빠지고, 필수 포함은 사용자가 고른 곳이라 남는다 — 한림공원 사례 (#1420)")
    void dropsInadmissibleFavoritesButKeepsPinned() {
        AiPlanJob job = pendingJob(null);
        job.requestParams().put("petIds", "1,2");
        job.requestParams().put("pinnedPlaceIds", "126455");
        job.requestParams().put("preferFavorites", "true");
        RecordingCandidates candidates = new RecordingCandidates();
        candidates.general = List.of(
            located(100L, "관광지", 33.5, 126.5),
            // 이 대역은 검색 필터를 흉내 내지 않는다 — tour-service 를 빠져나온 것도 메모리에서 걸러진다
            restricted(101L, "소형견 전용 정원", AllowedPetSize.SMALL_ONLY, null));
        candidates.byIds = List.of(
            restricted(126455L, "한림공원", AllowedPetSize.SMALL_ONLY, 7),
            restricted(500L, "소형견 카페", AllowedPetSize.SMALL_ONLY, null),
            restricted(501L, "중소형견 카페", AllowedPetSize.SMALL_MEDIUM, 15),
            // 크기는 받지만 상한 7kg — 체중 미상 보리는 중형견 정의상 10kg 이상이라 들어갈 수 없다
            restricted(502L, "7kg 이하 카페", AllowedPetSize.ALL, 7));
        StubPetConditions pets = new StubPetConditions();
        pets.conditions = BORI_AND_MONGSIL;
        StubFavorites favorites = new StubFavorites();
        favorites.favoriteIds = List.of(500L, 501L, 502L);
        RecordingLlm llm = new RecordingLlm();

        worker(new FakeJobStore(job), new FakeJobEvents(), llm, candidates, pets, favorites).runJob(JOB_ID);

        assertThat(llm.lastQuery.safeCandidates()).extracting(PlaceCandidate::placeId).containsExactly(126455L, 100L, 501L);
    }

    private static PlaceCandidateQueryResult restricted(
        long placeId, String title, AllowedPetSize allowedPetSize, Integer maxPetWeightKg
    ) {
        return PlaceCandidateQueryResult.builder()
            .placeId(placeId).title(title).contentTypeName("관광지")
            .allowedPetSize(allowedPetSize).maxPetWeightKg(maxPetWeightKg).lat(33.5).lng(126.5)
            .build();
    }

    /** 일반 후보는 북부 25곳(id 1~25) · 남서부 25곳(id 26~50), 거리순 조회는 북동부에서만 방문 10 · 숙박 4 · 음식점 4곳을 돌려준다. */
    private static RecordingCandidates northEastFocusReady() {
        RecordingCandidates candidates = new RecordingCandidates();
        List<PlaceCandidateQueryResult> general = new ArrayList<>();
        for (long id = 1; id <= 50; id++) {
            general.add(id <= 25 ? located(id, "관광지", 33.5, 126.5) : located(id, "관광지", 33.25, 126.36));
        }
        candidates.general = general;
        List<PlaceCandidateQueryResult> visits = new ArrayList<>();
        for (int index = 0; index < 10; index++) {
            visits.add(located(901L + index, "관광지", 33.4600 + index * 0.001, 126.8800));
        }
        candidates.nearbyVisits.put(JejuZone.NORTH_EAST, visits);
        candidates.nearbyLodgings.put(JejuZone.NORTH_EAST, List.of(
            located(951L, "숙박", 33.4700, 126.8700), located(952L, "숙박", 33.4710, 126.8700),
            located(953L, "숙박", 33.4720, 126.8700), located(954L, "숙박", 33.4730, 126.8700)));
        candidates.nearbyRestaurants.put(JejuZone.NORTH_EAST, List.of(
            located(961L, "음식점", 33.4800, 126.8600), located(962L, "음식점", 33.4810, 126.8600),
            located(963L, "음식점", 33.4820, 126.8600), located(964L, "음식점", 33.4830, 126.8600)));
        return candidates;
    }

    /** 일반 후보는 북부 50곳(id 1~50, 남동부 0), 거리순 조회는 남동부에서만 방문 5 · 숙박 3 · 음식점 3곳을 돌려준다. */
    private static RecordingCandidates southEastReady() {
        RecordingCandidates candidates = new RecordingCandidates();
        List<PlaceCandidateQueryResult> general = new ArrayList<>();
        for (long id = 1; id <= 50; id++) {
            general.add(PlaceCandidateQueryResult.builder()
                .placeId(id).title("북부" + id).contentTypeName("관광지").lat(33.5).lng(126.5).build());
        }
        candidates.general = general;
        candidates.nearbyVisits.put(JejuZone.SOUTH_EAST, List.of(
            located(901L, "관광지", 33.3260, 126.8420), located(902L, "관광지", 33.3523, 126.7470),
            located(903L, "관광지", 33.2800, 126.7200), located(904L, "관광지", 33.3000, 126.7600),
            // 남동부 대표점에서 찾았어도 경계 너머(북동부)면 어느 권역 몫으로도 싣지 않는다
            located(905L, "관광지", 33.4592, 126.8317)));
        candidates.nearbyLodgings.put(JejuZone.SOUTH_EAST, List.of(
            located(911L, "숙박", 33.3300, 126.8000), located(912L, "숙박", 33.3100, 126.7900),
            located(913L, "숙박", 33.3200, 126.8100)));
        candidates.nearbyRestaurants.put(JejuZone.SOUTH_EAST, List.of(
            located(921L, "음식점", 33.3250, 126.8300), located(922L, "음식점", 33.2900, 126.7300),
            located(923L, "음식점", 33.3150, 126.8200)));
        return candidates;
    }

    private static PlaceCandidateQueryResult located(long placeId, String contentTypeName, double lat, double lng) {
        return PlaceCandidateQueryResult.builder()
            .placeId(placeId).title("장소" + placeId).contentTypeName(contentTypeName).lat(lat).lng(lng)
            .build();
    }

    // 단계별 소요 지표 (#985) ────────────────────────────────────────────────

    @Test
    @DisplayName("성공한 잡은 네 단계를 모두 completed 로 닫는다")
    void recordsEveryStepAsCompletedOnSuccess() {
        worker(new FakeJobStore(pendingJob(null)), new FakeJobEvents(), new RecordingLlm()).runJob(JOB_ID);

        assertThat(metrics.recorded).containsExactly(
            new RecordedStep(AiPlanJobStep.CONDITIONS, AiPlanJobMode.FULL, AiPlanStepOutcome.COMPLETED),
            new RecordedStep(AiPlanJobStep.CANDIDATES, AiPlanJobMode.FULL, AiPlanStepOutcome.COMPLETED),
            new RecordedStep(AiPlanJobStep.WEATHER, AiPlanJobMode.FULL, AiPlanStepOutcome.COMPLETED),
            new RecordedStep(AiPlanJobStep.DRAFTING, AiPlanJobMode.FULL, AiPlanStepOutcome.COMPLETED));
        assertThat(metrics.elapsed).allSatisfy(elapsed -> assertThat(elapsed.isNegative()).isFalse());
    }

    @Test
    @DisplayName("AI 호출이 실패하면 DRAFTING 을 failed 로 닫는다 — 앞 단계는 completed 다")
    void recordsTheFailingStepAsFailed() {
        RecordingLlm llm = new RecordingLlm();
        llm.failing = true;

        worker(new FakeJobStore(pendingJob(null)), new FakeJobEvents(), llm).runJob(JOB_ID);

        assertThat(metrics.recorded).hasSize(AiPlanJobStep.total());
        assertThat(metrics.recorded.getLast())
            .isEqualTo(new RecordedStep(AiPlanJobStep.DRAFTING, AiPlanJobMode.FULL, AiPlanStepOutcome.FAILED));
        assertThat(metrics.recorded.subList(0, 3)).extracting(RecordedStep::outcome).containsOnly(AiPlanStepOutcome.COMPLETED);
    }

    @Test
    @DisplayName("단계 경계에서 취소를 보면 막 끝낸 단계를 canceled 로 닫고, 들어가지 않은 단계는 남기지 않는다")
    void recordsTheLastStepAsCanceledWhenStoppedAtBoundary() {
        FakeJobStore store = new FakeJobStore(pendingJob(null));
        store.cancelBefore = AiPlanJobStep.CANDIDATES;

        worker(store, new FakeJobEvents(), new RecordingLlm()).runJob(JOB_ID);

        assertThat(metrics.recorded).containsExactly(
            new RecordedStep(AiPlanJobStep.CONDITIONS, AiPlanJobMode.FULL, AiPlanStepOutcome.CANCELED));
    }

    @Test
    @DisplayName("생성 도중 취소돼 초안을 버리면 DRAFTING 을 canceled 로 닫는다")
    void recordsDraftingAsCanceledWhenDraftIsDiscarded() {
        FakeJobStore store = new FakeJobStore(pendingJob(null));
        RecordingLlm llm = new RecordingLlm();
        llm.onCall = () -> store.forceStatus(AiPlanJobStatus.CANCELED);

        worker(store, new FakeJobEvents(), llm).runJob(JOB_ID);

        assertThat(metrics.recorded.getLast())
            .isEqualTo(new RecordedStep(AiPlanJobStep.DRAFTING, AiPlanJobMode.FULL, AiPlanStepOutcome.CANCELED));
    }

    @Test
    @DisplayName("생성 도중 타임아웃 판정(FAILED)되면 DRAFTING 을 failed 로 닫는다 — 취소와 섞지 않는다")
    void recordsDraftingAsFailedWhenTimedOutDuringGeneration() {
        FakeJobStore store = new FakeJobStore(pendingJob(null));
        RecordingLlm llm = new RecordingLlm();
        llm.onCall = () -> store.forceStatus(AiPlanJobStatus.FAILED);

        worker(store, new FakeJobEvents(), llm).runJob(JOB_ID);

        assertThat(metrics.recorded.getLast())
            .isEqualTo(new RecordedStep(AiPlanJobStep.DRAFTING, AiPlanJobMode.FULL, AiPlanStepOutcome.FAILED));
    }

    @Test
    @DisplayName("하루 재생성은 mode=regenerate 로 남는다")
    void tagsRegenerationAsRegenerateMode() {
        AiPlanJob regenerate = pendingJob(null);
        regenerate.requestParams().put("planId", "55");
        regenerate.requestParams().put("regenerateDay", "2");

        worker(new FakeJobStore(regenerate), new FakeJobEvents(), new RecordingLlm()).runJob(JOB_ID);

        assertThat(metrics.recorded).hasSize(AiPlanJobStep.total())
            .extracting(RecordedStep::mode).containsOnly(AiPlanJobMode.REGENERATE);
    }

    @Test
    @DisplayName("지표 기록이 실패해도 잡은 완료된다 — 관측이 결과를 바꾸지 않는다")
    void completesEvenWhenMetricRecordingFails() {
        metrics.failing = true;
        FakeJobStore store = new FakeJobStore(pendingJob(null));

        worker(store, new FakeJobEvents(), new RecordingLlm()).runJob(JOB_ID);

        assertThat(store.current().status()).isEqualTo(AiPlanJobStatus.COMPLETED);
    }

    // 픽스처 ──────────────────────────────────────────────────────────────

    private AiPlanWorker worker(FakeJobStore store, FakeJobEvents events, RecordingLlm llm) {
        return worker(store, events, llm, new RecordingCandidates());
    }

    private AiPlanWorker worker(
        FakeJobStore store, FakeJobEvents events, RecordingLlm llm, RecordingCandidates candidates
    ) {
        return worker(store, events, llm, candidates, new StubPetConditions(), new StubFavorites());
    }

    private AiPlanWorker worker(
        FakeJobStore store, FakeJobEvents events, RecordingLlm llm, RecordingCandidates candidates,
        StubPetConditions pets, StubFavorites favorites
    ) {
        return new AiPlanWorker(
            store, events, llm, candidates,
            pets, new StubPlanOutlines(), favorites, new StubWeather(),
            new AiLlmProperties(null, null, null, null, null, null, null, null, null, null, null, null), metrics);
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

    private static PlaceCandidateQueryResult place(
        long placeId, String title, String contentTypeName, Boolean indoor, String sourceCategory
    ) {
        return PlaceCandidateQueryResult.builder()
            .placeId(placeId).title(title).contentTypeName(contentTypeName)
            .indoor(indoor).sourceCategory(sourceCategory).lat(33.5).lng(126.5)
            .build();
    }

    private static PlaceCandidateQueryResult stay(long placeId, String title, double lat, double lng) {
        return PlaceCandidateQueryResult.builder()
            .placeId(placeId).title(title).contentTypeName("숙박").indoor(true).lat(lat).lng(lng)
            .build();
    }

    /** 실내 카페 — 실내 · 카페 요청 조건에도 맞는다. */
    private static PlaceCandidateQueryResult restaurant(long placeId, String title, double lat, double lng) {
        return PlaceCandidateQueryResult.builder()
            .placeId(placeId).title(title).contentTypeName("음식점").indoor(true).sourceCategory("카페")
            .lat(lat).lng(lng)
            .build();
    }

    /** 저장된 잡을 들고 있으면서 밟은 단계를 순서대로 기록한다. */
    private static final class FakeJobStore implements AiPlanJobStorePort {

        private AiPlanJob job;
        private final List<AiPlanJobStep> observedSteps = new ArrayList<>();
        /** 단계 전이마다 저장된 단계 시작 시각. observedSteps 와 같은 순서다. */
        private final List<Instant> observedStepStarts = new ArrayList<>();
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
                observedStepStarts.add(saving.stepStartedAt());
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
        private AiPlanGenerationQuery lastQuery;
        /** 돌려줄 초안. 비우면 일자도 근거도 없는 초안이다. */
        private AiPlanDraft draft;

        @Override
        public AiPlanDraft generatePlanDraft(AiPlanGenerationQuery query) {
            calls++;
            lastQuery = query;
            if (onCall != null) {
                onCall.run();
            }
            if (failing) {
                throw new IllegalStateException("model exploded");
            }
            return draft != null ? draft : AiPlanDraft.builder().days(List.of()).reasons(List.of()).build();
        }

        @Override
        public PackingList generatePackingList(PackingChecklistQuery query) {
            throw new UnsupportedOperationException();
        }
    }

    private static final class RecordingCandidates implements PlaceCandidateQueryPort {

        private String requestedSigunguCode;
        private boolean captured;
        /** 요청 조건 검색이 돌려줄 장소. 비우면 맞는 곳이 없는 지역이다. */
        private List<PlaceCandidateQueryResult> requested = List.of();
        private int requestedLookups;
        private Boolean requestedIndoor;
        private String requestedCategory;
        /** 숙박 검색이 돌려줄 숙소 (#1236). 비우면 숙박을 더 싣지 않는다. */
        private List<PlaceCandidateQueryResult> stays = List.of();
        private AiPlanException lodgingFailure;
        private String lodgingSigunguCode;
        /** 음식점 검색이 돌려줄 장소 (#1245). 비우면 음식점을 더 싣지 않는다. */
        private List<PlaceCandidateQueryResult> restaurants = List.of();
        private int requestedSize;
        /** 일반 검색 결과 (#1312). null 이면 북부 후보 하나(100)다. */
        private List<PlaceCandidateQueryResult> general;
        /** 권역 대표점마다 돌려줄 거리순 결과 (#1312). 없는 권역은 비어 있다. */
        private final Map<JejuZone, List<PlaceCandidateQueryResult>> nearbyVisits = new EnumMap<>(JejuZone.class);
        private final Map<JejuZone, List<PlaceCandidateQueryResult>> nearbyLodgings = new EnumMap<>(JejuZone.class);
        private final Map<JejuZone, List<PlaceCandidateQueryResult>> nearbyRestaurants = new EnumMap<>(JejuZone.class);
        private AiPlanException nearbyVisitFailure;
        private int nearbyLookups;
        /** 아이디로 찾을 때(필수 포함 · 즐겨찾기) 돌려줄 장소 (#1423). 비우면 아무것도 찾지 못한다. */
        private List<PlaceCandidateQueryResult> byIds = List.of();
        /**
         * 검색 메서드마다 받은 입장 기준 (#1420). 이 대역은 기준으로 거르지 않는다 — 운영에서는 tour-service 가 거르고,
         * 그래도 남은 것은 워커가 메모리에서 거른다.
         */
        private final Map<String, List<PetAdmission>> admissions = new LinkedHashMap<>();

        private void record(String lookup, PetAdmission admission) {
            admissions.computeIfAbsent(lookup, key -> new ArrayList<>()).add(admission);
        }

        @Override
        public List<PlaceCandidateQueryResult> findNearbyCandidates(
            String areaCode, double lat, double lng, int size, PetAdmission admission
        ) {
            nearbyLookups++;
            record("findNearbyCandidates", admission);
            if (nearbyVisitFailure != null) {
                throw nearbyVisitFailure;
            }
            return nearbyVisits.getOrDefault(anchorZone(lat, lng), List.of());
        }

        @Override
        public List<PlaceCandidateQueryResult> findNearbyLodgingCandidates(
            String areaCode, double lat, double lng, int size, PetAdmission admission
        ) {
            nearbyLookups++;
            record("findNearbyLodgingCandidates", admission);
            return nearbyLodgings.getOrDefault(anchorZone(lat, lng), List.of());
        }

        @Override
        public List<PlaceCandidateQueryResult> findNearbyRestaurantCandidates(
            String areaCode, double lat, double lng, int size, PetAdmission admission
        ) {
            nearbyLookups++;
            record("findNearbyRestaurantCandidates", admission);
            return nearbyRestaurants.getOrDefault(anchorZone(lat, lng), List.of());
        }

        /** 이 좌표를 대표점으로 가진 권역. 대표점이 아니면 null — 거리순 조회는 대표점으로만 부른다. */
        private static JejuZone anchorZone(double lat, double lng) {
            for (JejuZone zone : JejuZone.values()) {
                if (zone.getAnchorLat() == lat && zone.getAnchorLng() == lng) {
                    return zone;
                }
            }
            return null;
        }

        @Override
        public List<PlaceCandidateQueryResult> findRestaurantCandidates(
            String areaCode, String sigunguCode, int size, PetAdmission admission
        ) {
            record("findRestaurantCandidates", admission);
            return restaurants;
        }

        @Override
        public List<PlaceCandidateQueryResult> findLodgingCandidates(String areaCode, String sigunguCode, int size, PetAdmission admission) {
            lodgingSigunguCode = sigunguCode;
            record("findLodgingCandidates", admission);
            if (lodgingFailure != null) {
                throw lodgingFailure;
            }
            return stays;
        }

        @Override
        public List<PlaceCandidateQueryResult> findPetFriendlyCandidates(
            String areaCode, String sigunguCode, int size, PetAdmission admission
        ) {
            requestedSigunguCode = sigunguCode;
            captured = true;
            record("findPetFriendlyCandidates", admission);
            if (general != null) {
                return general;
            }
            return List.of(PlaceCandidateQueryResult.builder()
                .placeId(100L).title("후보").lat(33.5).lng(126.5)
                .build());
        }

        @Override
        public List<PlaceCandidateQueryResult> findRequestedCandidates(
            String areaCode, String sigunguCode, int size, Boolean indoor, String sourceCategory, PetAdmission admission
        ) {
            record("findRequestedCandidates", admission);
            requestedLookups++;
            requestedSize = size;
            requestedIndoor = indoor;
            requestedCategory = sourceCategory;
            return requested;
        }

        @Override
        public List<PlaceCandidateQueryResult> findCandidatesByIds(List<Long> placeIds) {
            return byIds.stream().filter(result -> placeIds.contains(result.placeId())).toList();
        }
    }

    private static final class StubPetConditions implements PetConditionQueryPort {

        /** 반려견을 지정한 요청(petIds)이 받을 특성. 비우면 아무것도 찾지 못한다. */
        private List<PetCondition> conditions = List.of();

        @Override
        public List<PetCondition> findConditions(long memberId, List<Long> petIds) {
            return conditions;
        }

        @Override
        public Optional<PetCondition> findRepresentativeCondition(long memberId) {
            return Optional.of(PetCondition.builder().sizeName("소형견").build());
        }
    }

    private static final class StubPlanOutlines implements PlanOutlineQueryPort {

        @Override
        public Optional<PlanOutline> findOutline(long memberId, long planId) {
            return Optional.of(PlanOutline.builder().planId(planId).areaCode("39").days(List.of()).build());
        }
    }

    private static final class StubFavorites implements FavoritePlaceIdsQueryPort {

        /** 즐겨찾기 아이디. null 이면 불리면 안 되는 것이다 — 즐겨찾기 선호를 끈 요청이 기본이다. */
        private List<Long> favoriteIds;

        @Override
        public List<Long> findFavoritePlaceIds(long memberId) {
            if (favoriteIds == null) {
                throw new UnsupportedOperationException();
            }
            return favoriteIds;
        }
    }

    private static final class StubWeather implements WeatherOutlookQueryPort {

        @Override
        public List<DayWeatherOutlook> findDailyOutlook(String areaCode) {
            return List.of();
        }
    }

    private record RecordedStep(AiPlanJobStep step, AiPlanJobMode mode, AiPlanStepOutcome outcome) {
    }

    private static final class RecordingMetrics implements AiPlanJobMetricsPort {

        private final List<RecordedStep> recorded = new ArrayList<>();
        private final List<Duration> elapsed = new ArrayList<>();
        private boolean failing;

        @Override
        public void recordStep(AiPlanJobStep step, AiPlanJobMode mode, AiPlanStepOutcome outcome, Duration stepElapsed) {
            if (failing) {
                throw new IllegalStateException("registry down");
            }
            recorded.add(new RecordedStep(step, mode, outcome));
            elapsed.add(stepElapsed);
        }
    }
}
