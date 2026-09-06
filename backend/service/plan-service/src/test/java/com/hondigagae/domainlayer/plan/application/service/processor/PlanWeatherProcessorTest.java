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
import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import com.hondigagae.domainlayer.plan.domain.model.PlanItem;
import java.time.LocalDate;
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
 * <p>고정하는 것은 셋이다.
 * <ul>
 *   <li><b>누구 기준인가</b> — 점수가 가장 낮은 아이. 화면이 "몽실이 기준" 이라고 말할 수 있어야 한다
 *   <li><b>몇 번 부르는가</b> — 조건이 다른 아이 수만큼. 조건이 같으면(특성을 못 받아 전부 일반 조건이 됐을 때 포함) 한 번
 *   <li><b>한 아이의 특성이 없어도</b> — 그 아이는 일반 조건으로 판정에 남고, 브리핑은 나간다
 * </ul>
 */
class PlanWeatherProcessorTest {

    private static final long PLAN_ID = 900L;
    private static final long PLACE_ID = 100L;
    private static final long MONGSIL = 2L;
    private static final long BORI = 5L;
    private static final LocalDate DAY_1 = LocalDate.of(2026, 9, 12);

    private static final PetConditionQueryResult HEAT_SENSITIVE = PetConditionQueryResult.builder()
        .sizeType("SMALL").heatSensitive(true).build();
    private static final PetConditionQueryResult ROBUST = PetConditionQueryResult.builder()
        .sizeType("LARGE").build();

    private StubPetConditionQueryPort petConditionQueryPort;
    private StubPlaceSuitabilityQueryPort placeSuitabilityQueryPort;
    private PlanWeatherProcessor processor;

    @BeforeEach
    void setUp() {
        petConditionQueryPort = new StubPetConditionQueryPort();
        placeSuitabilityQueryPort = new StubPlaceSuitabilityQueryPort();
        processor = new PlanWeatherProcessor(new StubPlanItemRepositoryPort(), petConditionQueryPort, placeSuitabilityQueryPort);
    }

    private static Plan plan() {
        return Plan.builder()
            .id(PLAN_ID).memberId(1L).petId(MONGSIL).areaCode("39").title("몽실이·보리와 제주 당일치기")
            .startDate(DAY_1).endDate(DAY_1).status(PlanStatus.DRAFT).build();
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
    @DisplayName("tour-service 조회가 전부 실패하면 그날은 unavailableReason 이고 아이별 목록은 비어 있다")
    void unavailableWhenEveryLookupFails() {
        petConditionQueryPort.conditions = Map.of(MONGSIL, HEAT_SENSITIVE, BORI, ROBUST);
        placeSuitabilityQueryPort.unavailable = true;

        PlanWeatherInfo info = processor.brief(1L, plan(), List.of(MONGSIL, BORI));

        assertThat(firstDay(info).unavailableReason()).isNotNull();
        assertThat(firstDay(info).basisPetId()).isNull();
        assertThat(firstDay(info).petSuitabilities()).isEmpty();
    }

    // ── 스텁 ───────────────────────────────────────────────────────────────

    private static class StubPetConditionQueryPort implements PetConditionQueryPort {

        private Map<Long, PetConditionQueryResult> conditions = Map.of();

        @Override
        public Map<Long, PetConditionQueryResult> findConditions(long memberId, List<Long> petIds) {
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
        private boolean unavailable;
        private Function<PetConditionQueryResult, Integer> scoreOf = condition -> 60;

        @Override
        public Optional<PlaceSuitabilityQueryResult> findSuitability(long placeId, LocalDate targetDate, PetConditionQueryResult pet) {
            calls += 1;
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

        @Override
        public List<PlanItem> findByPlanId(long planId) {
            return List.of(PlanItem.builder()
                .id(1000L).planId(planId).day(1).sequence(0)
                .itemType(PlanItemType.PLACE).targetId(PLACE_ID).title("협재해수욕장")
                .build());
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
