package com.hondigagae.domainlayer.plan.application.service.processor;

import com.hondigagae.domainlayer.plan.application.port.out.query.PlanItemCountQueryResult;
import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.plan.application.info.PlanCompanionSummaryInfo;
import com.hondigagae.domainlayer.plan.application.port.out.PlanItemRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanPetRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanRepositoryPort;
import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import com.hondigagae.domainlayer.plan.domain.model.PlanItem;
import com.hondigagae.domainlayer.plan.domain.model.PlanPet;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Slice;

/**
 * 반려견 삭제 확인창 집계 (#972).
 *
 * <p>고정하는 것은 셋이다.
 * <ul>
 *   <li>상태 분리 — 초안·확정은 편집 가능, 완료는 기록 (대사 배치와 같은 선)</li>
 *   <li>"유일한 동행" 은 R3 발동 조건과 같다 — 조인 테이블이 이 아이 한 마리뿐이거나, 행이 없는 옛 일정의 대표</li>
 *   <li>조인 테이블 조회는 편집 가능 일정에 대해 <b>in 절 한 번</b>이다 (§9-7)</li>
 * </ul>
 */
class PlanCompanionSummaryTest {

    private static final long MEMBER_ID = 1L;
    private static final long OTHER_MEMBER_ID = 99L;
    private static final long BORI = 5L;
    private static final long MONGSIL = 7L;

    private FakePlanPetRepositoryPort planPetRepositoryPort;
    private FakePlanRepositoryPort planRepositoryPort;
    private PlanQueryProcessor processor;

    @BeforeEach
    void setUp() {
        planPetRepositoryPort = new FakePlanPetRepositoryPort();
        planRepositoryPort = new FakePlanRepositoryPort(planPetRepositoryPort);
        processor = new PlanQueryProcessor(planRepositoryPort, new UnusedPlanItemRepositoryPort(), planPetRepositoryPort,
            placeIds -> List.of(), walkCourseIds -> List.of());
    }

    @Test
    @DisplayName("편집 가능·유일 동행·완료를 따로 센다 — 옛 일정의 대표 한 마리도 유일 동행이다")
    void countsEditableSoleAndCompletedSeparately() {
        givenPlan(101L, MEMBER_ID, BORI, PlanStatus.DRAFT);          // 두 마리 중 대표 - 편집 가능, 유일 아님
        givenPlanPets(101L, BORI, MONGSIL);
        givenPlan(102L, MEMBER_ID, MONGSIL, PlanStatus.CONFIRMED);   // 두 번째 반려견 - 편집 가능, 유일 아님
        givenPlanPets(102L, MONGSIL, BORI);
        givenPlan(103L, MEMBER_ID, BORI, PlanStatus.CONFIRMED);      // 이 아이 한 마리 - R3 로 남는다
        givenPlanPets(103L, BORI);
        givenPlan(104L, MEMBER_ID, BORI, PlanStatus.DRAFT);          // 조인 테이블 행이 없는 옛 일정 - 유일 동행
        givenPlan(105L, MEMBER_ID, BORI, PlanStatus.COMPLETED);      // 완료 - 기록
        givenPlanPets(105L, BORI);
        givenPlan(106L, MEMBER_ID, MONGSIL, PlanStatus.DRAFT);       // 이 아이가 없는 일정 - 세지 않는다
        givenPlanPets(106L, MONGSIL);
        givenPlan(107L, OTHER_MEMBER_ID, BORI, PlanStatus.DRAFT);    // 남의 일정 - 세지 않는다
        givenPlanPets(107L, BORI);

        PlanCompanionSummaryInfo summary = processor.getCompanionSummary(MEMBER_ID, BORI);

        assertThat(summary.petId()).isEqualTo(BORI);
        assertThat(summary.editablePlanCount()).isEqualTo(4);
        assertThat(summary.soleCompanionPlanCount()).isEqualTo(2);
        assertThat(summary.completedPlanCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("조인 테이블은 편집 가능 일정에 대해 in 절 한 번만 읽는다 — 완료 일정은 싣지 않는다")
    void readsCompanionRowsOnceForEditablePlansOnly() {
        givenPlan(101L, MEMBER_ID, BORI, PlanStatus.DRAFT);
        givenPlanPets(101L, BORI, MONGSIL);
        givenPlan(102L, MEMBER_ID, BORI, PlanStatus.CONFIRMED);
        givenPlanPets(102L, BORI);
        givenPlan(103L, MEMBER_ID, BORI, PlanStatus.COMPLETED);
        givenPlanPets(103L, BORI);

        processor.getCompanionSummary(MEMBER_ID, BORI);

        assertThat(planPetRepositoryPort.bulkRequests).containsExactly(List.of(101L, 102L));
    }

    @Test
    @DisplayName("동행한 일정이 없거나 남의 반려견이면 전부 0 이고 조인 테이블을 읽지 않는다")
    void returnsZerosWithoutReadingCompanionRowsWhenNothingMatches() {
        givenPlan(101L, OTHER_MEMBER_ID, BORI, PlanStatus.DRAFT);
        givenPlanPets(101L, BORI);

        PlanCompanionSummaryInfo summary = processor.getCompanionSummary(MEMBER_ID, BORI);

        assertThat(summary.editablePlanCount()).isZero();
        assertThat(summary.soleCompanionPlanCount()).isZero();
        assertThat(summary.completedPlanCount()).isZero();
        assertThat(planPetRepositoryPort.bulkRequests).isEmpty();
    }

    @Test
    @DisplayName("완료 일정만 있으면 편집 가능 0 · 완료 수만 나오고 조인 테이블을 읽지 않는다")
    void completedOnlyDoesNotReadCompanionRows() {
        givenPlan(101L, MEMBER_ID, BORI, PlanStatus.COMPLETED);
        givenPlanPets(101L, BORI);
        givenPlan(102L, MEMBER_ID, MONGSIL, PlanStatus.COMPLETED);
        givenPlanPets(102L, MONGSIL, BORI);

        PlanCompanionSummaryInfo summary = processor.getCompanionSummary(MEMBER_ID, BORI);

        assertThat(summary.editablePlanCount()).isZero();
        assertThat(summary.soleCompanionPlanCount()).isZero();
        assertThat(summary.completedPlanCount()).isEqualTo(2);
        assertThat(planPetRepositoryPort.bulkRequests).isEmpty();
    }

    private void givenPlan(long planId, long memberId, long representativePetId, PlanStatus status) {
        planRepositoryPort.plans.put(planId, Plan.builder()
            .id(planId).memberId(memberId).petId(representativePetId).areaCode("39").title("일정 " + planId)
            .startDate(LocalDate.of(2026, 10, 1)).endDate(LocalDate.of(2026, 10, 3))
            .status(status).deleted(false)
            .build());
    }

    /** 인자 순서 = 저장 순서 (id 오름차순). */
    private void givenPlanPets(long planId, long... petIds) {
        long rowId = planId * 10;
        for (long petId : petIds) {
            planPetRepositoryPort.rows.add(PlanPet.builder().id(rowId++).planId(planId).petId(petId).build());
        }
    }

    private static final class FakePlanRepositoryPort implements PlanRepositoryPort {

        private final Map<Long, Plan> plans = new LinkedHashMap<>();
        private final FakePlanPetRepositoryPort planPets;

        private FakePlanRepositoryPort(FakePlanPetRepositoryPort planPets) {
            this.planPets = planPets;
        }

        /** JPQL 술어를 흉내 낸다 — 회원·미삭제, 대표 컬럼 OR 조인 테이블, 상태 무관. 술어 자체는 H2 슬라이스 테스트가 본다. */
        @Override
        public List<Plan> findPlansWithPet(long memberId, long petId) {
            return plans.values().stream()
                .filter(plan -> plan.memberId() == memberId && !plan.deleted())
                .filter(plan -> plan.petId() == petId || planPets.rows.stream()
                    .anyMatch(row -> row.planId() == plan.id() && row.petId() == petId))
                .toList();
        }

        @Override
        public Optional<Plan> findActiveBySourceAiJobId(long memberId, String sourceAiJobId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public Plan save(Plan plan) {
            throw new UnsupportedOperationException();
        }

        @Override
        public Optional<Plan> findActiveById(long planId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public Slice<Plan> findMyPlans(long memberId, Long petId, long lastPlanId, int size) {
            throw new UnsupportedOperationException();
        }

        @Override
        public List<Plan> findCompanionEditablePlansWithPet(long memberId, long petId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public List<Plan> findCompanionEditablePlans(long memberId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public List<Long> findMemberIdsWithCompanionEditablePlans(long lastMemberId, int size) {
            throw new UnsupportedOperationException();
        }

        @Override
        public Optional<Plan> findActiveByIdForUpdate(long planId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public int promoteRepresentative(long planId, long petId, long expectedPetId) {
            throw new UnsupportedOperationException();
        }
    }

    private static final class FakePlanPetRepositoryPort implements PlanPetRepositoryPort {

        private final List<PlanPet> rows = new ArrayList<>();
        private final List<List<Long>> bulkRequests = new ArrayList<>();

        @Override
        public List<PlanPet> findByPlanIds(Collection<Long> planIds) {
            bulkRequests.add(List.copyOf(planIds));
            return rows.stream()
                .filter(row -> planIds.contains(row.planId()))
                .sorted(Comparator.comparingLong(PlanPet::id))
                .toList();
        }

        @Override
        public List<PlanPet> findByPlanId(long planId) {
            throw new UnsupportedOperationException("집계는 일정마다 조인 테이블을 읽지 않는다");
        }

        @Override
        public List<PlanPet> saveAll(List<PlanPet> pets) {
            throw new UnsupportedOperationException();
        }

        @Override
        public List<PlanPet> findByPlanIdForUpdate(long planId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void deleteByPlanId(long planId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public int deleteByPlanIdAndPetId(long planId, long petId) {
            throw new UnsupportedOperationException();
        }
    }

    private static final class UnusedPlanItemRepositoryPort implements PlanItemRepositoryPort {

        @Override
        public List<PlanItemCountQueryResult> countByPlanIds(Collection<Long> planIds) {
            throw new UnsupportedOperationException();
        }

        @Override
        public List<PlanItem> saveAll(List<PlanItem> items) {
            throw new UnsupportedOperationException();
        }

        @Override
        public List<PlanItem> findByPlanId(long planId) {
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
