package com.hondigagae.domainlayer.plan.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.plan.application.info.PlanWeatherInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanWeatherInfo.PetSuitabilityInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanWeatherInfo.PlanDayWeatherInfo;
import com.hondigagae.domainlayer.plan.application.port.out.PetConditionQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlaceSuitabilityQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanItemRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.query.PetConditionQueryResult;
import com.hondigagae.domainlayer.plan.application.port.out.query.PlaceSuitabilityQueryResult;
import com.hondigagae.shared.travel.plan.PlanItemType;
import com.hondigagae.domainlayer.plan.domain.enums.PlanDayWeatherUnavailableReason;
import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import com.hondigagae.domainlayer.plan.domain.model.PlanItem;
import com.hondigagae.domainlayer.plan.domain.model.PlanPetCondition;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 다견 날씨 브리핑 검증.
 *
 * <p>고정하는 것은 넷이다.
 * <ul>
 *   <li><b>누구 기준인가</b> — 점수가 가장 낮은 아이. 화면이 "몽실이 기준" 이라고 말할 수 있어야 한다
 *   <li><b>몇 번 부르는가</b> — 조건이 다른 아이 수만큼. 조건이 같으면(특성을 못 받아 전부 일반 조건이 됐을 때 포함) 한 번
 *   <li><b>한 아이의 특성이 없어도</b> — 그 아이는 일반 조건으로 판정에 남고, 브리핑은 나간다
 *   <li><b>못 낸 이유를 넷으로 가른다</b> — 지난 날짜 · 장소 미지정 · 예보 범위 밖 · 조회 실패 (#492).
 *       뭉뚱그리면 지난 날짜에 "잠시 후 다시 시도" 라는 지켜지지 않을 안내가 나간다
 * </ul>
 *
 * <p>"오늘" 은 {@link Clock} 으로 고정한다 — {@code DAY_1} 이 오늘이다. 시스템 시각을 쓰면
 * 이 파일의 날짜가 지나는 순간 "지난 날짜" 분기가 모든 테스트를 삼킨다.
 */
class PlanWeatherProcessorTest {

    private static final long PLAN_ID = 900L;
    private static final long PLACE_ID = 100L;
    private static final long MONGSIL = 2L;
    private static final long BORI = 5L;
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final LocalDate DAY_1 = LocalDate.of(2026, 9, 12);
    private static final Clock CLOCK = Clock.fixed(DAY_1.atStartOfDay(SEOUL).toInstant(), SEOUL);

    private static final PetConditionQueryResult HEAT_SENSITIVE = PetConditionQueryResult.builder()
        .sizeType("SMALL").heatSensitive(true).build();
    private static final PetConditionQueryResult ROBUST = PetConditionQueryResult.builder()
        .sizeType("LARGE").build();

    private StubPlanItemRepositoryPort planItemRepositoryPort;
    private StubPetConditionQueryPort petConditionQueryPort;
    private StubPlaceSuitabilityQueryPort placeSuitabilityQueryPort;
    private StubPlanPetConditionRepositoryPort planPetConditionRepositoryPort;
    private PlanWeatherProcessor processor;

    @BeforeEach
    void setUp() {
        planItemRepositoryPort = new StubPlanItemRepositoryPort();
        petConditionQueryPort = new StubPetConditionQueryPort();
        placeSuitabilityQueryPort = new StubPlaceSuitabilityQueryPort();
        planPetConditionRepositoryPort = new StubPlanPetConditionRepositoryPort();
        processor = new PlanWeatherProcessor(
            planItemRepositoryPort, petConditionQueryPort, planPetConditionRepositoryPort,
            placeSuitabilityQueryPort, CLOCK);
    }

    private static Plan plan() {
        return planOn(DAY_1);
    }

    /** 하루짜리 일정. 날짜를 옮겨 가며 일자 판정 사유를 가른다. */
    private static Plan planOn(LocalDate date) {
        return Plan.builder()
            .id(PLAN_ID).memberId(1L).petId(MONGSIL).areaCode("39").title("몽실이·보리와 제주 당일치기")
            .startDate(date).endDate(date).status(PlanStatus.DRAFT).build();
    }

    private static PlanDayWeatherInfo firstDay(PlanWeatherInfo info) {
        return info.days().get(0);
    }

    @Test
    @DisplayName("점수가 가장 낮은 아이가 그날의 기준이 된다 — 한 마리라도 힘든 날이면 그날은 힘든 날이다")
    void basisIsTheLowestScoringPet() {
        petConditionQueryPort.conditions = Map.of(MONGSIL, HEAT_SENSITIVE, BORI, ROBUST);
        placeSuitabilityQueryPort.scoreOf = condition -> condition.heatSensitive() ? 42 : 81;

        PlanWeatherInfo info = processor.brief(1L, plan(), List.of(MONGSIL, BORI));

        PlanDayWeatherInfo day = firstDay(info);
        assertThat(day.basisPetId()).isEqualTo(MONGSIL);
        assertThat(day.suitability().score()).isEqualTo(42);
        assertThat(day.petSuitabilities()).extracting(PetSuitabilityInfo::petId).containsExactly(MONGSIL, BORI);
        assertThat(day.petSuitabilities()).extracting(PetSuitabilityInfo::score).containsExactly(42, 81);
        assertThat(info.petIds()).containsExactly(MONGSIL, BORI);
        assertThat(info.petConditionApplied()).isTrue();
    }

    @Test
    @DisplayName("조건이 다른 아이 수만큼만 tour-service 를 부른다 — 두 마리면 하루에 두 번")
    void callsOncePerDistinctCondition() {
        petConditionQueryPort.conditions = Map.of(MONGSIL, HEAT_SENSITIVE, BORI, ROBUST);

        processor.brief(1L, plan(), List.of(MONGSIL, BORI));

        assertThat(placeSuitabilityQueryPort.calls).isEqualTo(2);
    }

    @Test
    @DisplayName("조건이 같은 아이들은 한 번만 묻는다 — 특성을 못 받아 전부 일반 조건이 됐을 때 마리 수만큼 반복하지 않는다")
    void deduplicatesIdenticalConditions() {
        petConditionQueryPort.conditions = Map.of(); // auth-service 장애: 아무 특성도 못 받았다

        PlanWeatherInfo info = processor.brief(1L, plan(), List.of(MONGSIL, BORI));

        assertThat(placeSuitabilityQueryPort.calls).isEqualTo(1);
        assertThat(info.petConditionApplied()).isFalse();
        // 판정은 두 마리 몫으로 나눠 준다 — 응답의 아이 목록은 요청한 아이 전부다
        assertThat(firstDay(info).petSuitabilities()).extracting(PetSuitabilityInfo::petId).containsExactly(MONGSIL, BORI);
        assertThat(firstDay(info).basisPetId()).isEqualTo(MONGSIL);
    }

    @Test
    @DisplayName("한 아이의 특성만 없으면 그 아이는 일반 조건으로 판정에 남는다 — 특성 부재가 그 아이를 지우지 않는다")
    void missingConditionFallsBackToUnknownForThatPet() {
        petConditionQueryPort.conditions = Map.of(MONGSIL, HEAT_SENSITIVE);
        placeSuitabilityQueryPort.scoreOf = condition -> condition.heatSensitive() ? 42 : 70;

        PlanWeatherInfo info = processor.brief(1L, plan(), List.of(MONGSIL, BORI));

        assertThat(placeSuitabilityQueryPort.calls).isEqualTo(2);
        assertThat(firstDay(info).petSuitabilities()).extracting(PetSuitabilityInfo::score).containsExactly(42, 70);
        assertThat(info.petConditionApplied()).isTrue();
    }

    @Test
    @DisplayName("한 마리 일정은 예전과 같다 — 기준은 그 아이, 아이별 목록은 원소 하나")
    void singlePetBehavesAsBefore() {
        petConditionQueryPort.conditions = Map.of(MONGSIL, HEAT_SENSITIVE);

        PlanWeatherInfo info = processor.brief(1L, plan(), List.of(MONGSIL));

        assertThat(placeSuitabilityQueryPort.calls).isEqualTo(1);
        assertThat(firstDay(info).basisPetId()).isEqualTo(MONGSIL);
        assertThat(firstDay(info).petSuitabilities()).hasSize(1);
    }

    @Test
    @DisplayName("점수를 못 낸(예보 밖) 날은 첫 아이를 기준으로 두어 날씨·이유는 보여 준다")
    void fallsBackToFirstPetWhenNoScore() {
        petConditionQueryPort.conditions = Map.of(MONGSIL, HEAT_SENSITIVE, BORI, ROBUST);
        placeSuitabilityQueryPort.scoreOf = condition -> null;

        PlanWeatherInfo info = processor.brief(1L, plan(), List.of(MONGSIL, BORI));

        assertThat(firstDay(info).basisPetId()).isEqualTo(MONGSIL);
        assertThat(firstDay(info).suitability().score()).isNull();
        assertThat(firstDay(info).unavailableReason()).isNull();
    }

    @Test
    @DisplayName("tour-service 조회가 전부 실패하면 LOOKUP_FAILED 다 — 넷 중 이것만 재시도가 의미 있는 상태다")
    void unavailableWhenEveryLookupFails() {
        petConditionQueryPort.conditions = Map.of(MONGSIL, HEAT_SENSITIVE, BORI, ROBUST);
        placeSuitabilityQueryPort.unavailable = true;

        PlanWeatherInfo info = processor.brief(1L, plan(), List.of(MONGSIL, BORI));

        assertThat(firstDay(info).unavailableReason()).isEqualTo(PlanDayWeatherUnavailableReason.LOOKUP_FAILED);
        assertThat(firstDay(info).basisPetId()).isNull();
        assertThat(firstDay(info).petSuitabilities()).isEmpty();
        // 장소는 알고 있었다 — 못 낸 것은 판정이지 대표 장소가 아니다
        assertThat(firstDay(info).representativePlaceId()).isEqualTo(PLACE_ID);
    }

    @Test
    @DisplayName("지난 날짜는 PAST_DATE 다 — 예보가 소급되지 않으므로 묻지 않고, 재시도도 권하지 않는다 (#492)")
    void pastDateIsNeverAsked() {
        petConditionQueryPort.conditions = Map.of(MONGSIL, HEAT_SENSITIVE);

        PlanWeatherInfo info = processor.brief(1L, planOn(DAY_1.minusDays(1)), List.of(MONGSIL));

        PlanDayWeatherUnavailableReason reason = firstDay(info).unavailableReason();
        assertThat(reason).isEqualTo(PlanDayWeatherUnavailableReason.PAST_DATE);
        // 일시적 장애와 같은 말을 하지 않는다 — 이 구분이 이 이슈의 본체다
        assertThat(reason.getDescription())
            .isNotEqualTo(PlanDayWeatherUnavailableReason.LOOKUP_FAILED.getDescription())
            .doesNotContain("다시 시도");
        // 물어도 답이 정해져 있는 날이라 원격 호출이 나가지 않는다
        assertThat(placeSuitabilityQueryPort.calls).isZero();
        // 장소는 지정돼 있었다 — "장소가 없어서" 가 아니라는 것이 응답에 남는다
        assertThat(firstDay(info).representativePlaceId()).isEqualTo(PLACE_ID);
        assertThat(firstDay(info).petSuitabilities()).isEmpty();
    }

    @Test
    @DisplayName("예보가 닿지 않는 먼 미래는 BEYOND_FORECAST_RANGE 다 — 오늘+11일부터")
    void beyondForecastRangeIsNeverAsked() {
        petConditionQueryPort.conditions = Map.of(MONGSIL, HEAT_SENSITIVE);
        int horizon = PlanDayWeatherUnavailableReason.FORECAST_HORIZON_DAYS;

        PlanWeatherInfo lastCovered = processor.brief(1L, planOn(DAY_1.plusDays(horizon)), List.of(MONGSIL));
        PlanWeatherInfo beyond = processor.brief(1L, planOn(DAY_1.plusDays(horizon + 1L)), List.of(MONGSIL));

        // 경계 안쪽(오늘+10)은 실제로 물어본다
        assertThat(firstDay(lastCovered).unavailableReason()).isNull();
        assertThat(firstDay(beyond).unavailableReason())
            .isEqualTo(PlanDayWeatherUnavailableReason.BEYOND_FORECAST_RANGE);
        assertThat(placeSuitabilityQueryPort.calls).isEqualTo(1);
    }

    @Test
    @DisplayName("장소가 없는 날은 NO_PLACE_ITEM 이다 — 날씨의 문제가 아니라 일정의 문제다")
    void noPlaceItemKeepsItsOwnReason() {
        planItemRepositoryPort.items = List.of();
        petConditionQueryPort.conditions = Map.of(MONGSIL, HEAT_SENSITIVE);

        PlanWeatherInfo info = processor.brief(1L, plan(), List.of(MONGSIL));

        assertThat(firstDay(info).unavailableReason()).isEqualTo(PlanDayWeatherUnavailableReason.NO_PLACE_ITEM);
        assertThat(firstDay(info).representativePlaceId()).isNull();
        assertThat(placeSuitabilityQueryPort.calls).isZero();
    }

    @Test
    @DisplayName("여행 중 일정은 일자마다 사유가 갈린다 — 지난 일차는 PAST_DATE, 오늘은 판정이 나간다")
    void reasonsDifferPerDayWithinOnePlan() {
        planItemRepositoryPort.items = List.of(
            PlanItem.builder().id(1L).planId(PLAN_ID).day(1).sequence(0)
                .itemType(PlanItemType.PLACE).targetId(PLACE_ID).title("성판악").build(),
            PlanItem.builder().id(2L).planId(PLAN_ID).day(2).sequence(0)
                .itemType(PlanItemType.PLACE).targetId(PLACE_ID).title("협재해수욕장").build());
        petConditionQueryPort.conditions = Map.of(MONGSIL, HEAT_SENSITIVE);
        Plan plan = Plan.builder()
            .id(PLAN_ID).memberId(1L).petId(MONGSIL).areaCode("39").title("여행 중인 일정")
            .startDate(DAY_1.minusDays(1)).endDate(DAY_1).status(PlanStatus.DRAFT).build();

        PlanWeatherInfo info = processor.brief(1L, plan, List.of(MONGSIL));

        assertThat(info.days()).extracting(PlanDayWeatherInfo::unavailableReason)
            .containsExactly(PlanDayWeatherUnavailableReason.PAST_DATE, null);
        // 지난 일차 몫의 호출이 빠져 오늘치 한 번만 나간다
        assertThat(placeSuitabilityQueryPort.calls).isEqualTo(1);
    }

    @Test
    @DisplayName("WALK 항목은 대표 장소가 되지 않는다 — targetId 가 walk_course.id 라 장소 적합도를 물을 수 없다 (#89)")
    void walkItemIsNotTheRepresentativePlace() {
        planItemRepositoryPort.items = List.of(
            PlanItem.builder().id(1L).planId(PLAN_ID).day(1).sequence(0)
                .itemType(PlanItemType.WALK).targetId(777L).title("올레 7코스").build(),
            PlanItem.builder().id(2L).planId(PLAN_ID).day(1).sequence(1)
                .itemType(PlanItemType.PLACE).targetId(PLACE_ID).title("협재해수욕장").build());
        petConditionQueryPort.conditions = Map.of(MONGSIL, HEAT_SENSITIVE);

        processor.brief(1L, plan(), List.of(MONGSIL));

        assertThat(placeSuitabilityQueryPort.lastPlaceId).isEqualTo(PLACE_ID);
    }

    // ── 스텁 ───────────────────────────────────────────────────────────────

@Test
    @DisplayName("완료된 일정은 완료 시점 스냅샷으로 판정한다 — 다녀온 뒤 프로필을 고쳐도 그때 기준이 흔들리지 않는다")
    void completedPlanUsesSnapshot() {
        // 지금 프로필은 더위에 강하다고 말하지만, 다녀올 당시에는 더위에 약했다.
        petConditionQueryPort.conditions = Map.of(MONGSIL, ROBUST);
        planPetConditionRepositoryPort.saveAll(List.of(snapshot(MONGSIL, true)));
        placeSuitabilityQueryPort.scoreOf = condition -> condition.heatSensitive() ? 42 : 81;

        PlanWeatherInfo info = processor.brief(1L, completedPlan(), List.of(MONGSIL));

        assertThat(firstDay(info).suitability().score()).isEqualTo(42);
        // 스냅샷이 있으면 원천을 묻지 않는다 — 기록을 읽는 데 남의 서비스를 왕복할 이유가 없다.
        assertThat(petConditionQueryPort.calls).isZero();
    }

    @Test
    @DisplayName("진행 중인 일정은 지금 프로필을 읽는다 — 아이 상태가 바뀌면 다음 판정에 곧바로 반영된다")
    void ongoingPlanUsesLiveConditions() {
        petConditionQueryPort.conditions = Map.of(MONGSIL, HEAT_SENSITIVE);
        // 초안인데도 스냅샷이 남아 있는 상황(완료했다가 되돌림). 진행 중이면 쓰지 않는다.
        planPetConditionRepositoryPort.saveAll(List.of(snapshot(MONGSIL, false)));
        placeSuitabilityQueryPort.scoreOf = condition -> condition.heatSensitive() ? 42 : 81;

        PlanWeatherInfo info = processor.brief(1L, plan(), List.of(MONGSIL));

        assertThat(firstDay(info).suitability().score()).isEqualTo(42);
        assertThat(petConditionQueryPort.calls).isEqualTo(1);
    }

    @Test
    @DisplayName("스냅샷이 없는 완료 일정은 예전처럼 원천을 읽는다 — 없는 기록을 지어내지 않는다")
    void completedPlanWithoutSnapshotFallsBackToLive() {
        petConditionQueryPort.conditions = Map.of(MONGSIL, HEAT_SENSITIVE);
        placeSuitabilityQueryPort.scoreOf = condition -> condition.heatSensitive() ? 42 : 81;

        PlanWeatherInfo info = processor.brief(1L, completedPlan(), List.of(MONGSIL));

        assertThat(firstDay(info).suitability().score()).isEqualTo(42);
        assertThat(petConditionQueryPort.calls).isEqualTo(1);
    }

    private static Plan completedPlan() {
        return planOn(DAY_1).toBuilder().status(PlanStatus.COMPLETED).build();
    }

    private static PlanPetCondition snapshot(long petId, boolean heatSensitive) {
        return PlanPetCondition.builder()
            .id(petId).planId(PLAN_ID).petId(petId)
            .sizeType("SMALL").heatSensitive(heatSensitive)
            .build();
    }

        private static class StubPetConditionQueryPort implements PetConditionQueryPort {

        private Map<Long, PetConditionQueryResult> conditions = Map.of();
        private int calls;

        @Override
        public Map<Long, PetConditionQueryResult> findConditions(long memberId, List<Long> petIds) {
            calls++;
            Map<Long, PetConditionQueryResult> found = new HashMap<>();
            petIds.forEach(petId -> {
                if (conditions.containsKey(petId)) {
                    found.put(petId, conditions.get(petId));
                }
            });
            return found;
        }

        @Override
        public Optional<Long> findRepresentativePetId(long memberId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public Set<Long> findOwnedPetIds(long memberId, List<Long> petIds) {
            throw new UnsupportedOperationException();
        }
    }

    private static class StubPlaceSuitabilityQueryPort implements PlaceSuitabilityQueryPort {

        private int calls;
        private Long lastPlaceId;
        private boolean unavailable;
        private Function<PetConditionQueryResult, Integer> scoreOf = condition -> 60;

        @Override
        public Optional<PlaceSuitabilityQueryResult> findSuitability(long placeId, LocalDate targetDate, PetConditionQueryResult pet) {
            calls += 1;
            lastPlaceId = placeId;
            if (unavailable) {
                return Optional.empty();
            }
            Integer score = scoreOf.apply(pet);
            return Optional.of(PlaceSuitabilityQueryResult.builder()
                .placeId(placeId).placeTitle("협재해수욕장").targetDate(targetDate)
                .score(score)
                .levelCode(score == null ? null : score >= 70 ? "HIGH" : "LOW")
                .levelName(score == null ? null : score >= 70 ? "여행 적합" : "주의")
                .reasons(List.of())
                .indoorAlternatives(List.of())
                .build());
        }
    }

    private static class StubPlanItemRepositoryPort implements PlanItemRepositoryPort {

        private List<PlanItem> items = List.of(PlanItem.builder()
            .id(1000L).planId(PLAN_ID).day(1).sequence(0)
            .itemType(PlanItemType.PLACE).targetId(PLACE_ID).title("협재해수욕장")
            .build());

        @Override
        public List<PlanItem> findByPlanId(long planId) {
            return items;
        }

        @Override
        public List<PlanItem> saveAll(List<PlanItem> items) {
            throw new UnsupportedOperationException();
        }

        @Override
        public Optional<PlanItem> findById(long planItemId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public PlanItem save(PlanItem item) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void deleteByPlanIdAndDay(long planId, int day) {
            throw new UnsupportedOperationException();
        }
    }
}
