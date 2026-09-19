package com.hondigagae.domainlayer.plan.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.plan.application.model.PlanCompanionReconcileCounts;
import com.hondigagae.domainlayer.plan.application.port.out.PlanPetRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanRepositoryPort;
import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
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
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;

/**
 * 삭제된 동행 반려견 정리 규칙 (#720).
 *
 * <p>매트릭스는 셋의 조합이다 — 일정 상태(DRAFT/CONFIRMED/COMPLETED) × 삭제된 아이가 대표인가 ×
 * 남은 마리 수(1 / 2 / 3+). 여기에 조인 테이블이 생기기 전의 옛 일정과 불변식이 깨진 일정을 더한다.
 *
 * <p>고정하는 것은 셋이다.
 * <ul>
 *   <li><b>완료 일정은 불가침</b> — 대상에서 빠지고, 목록을 만든 뒤 완료로 넘어갔어도 건드리지 않는다</li>
 *   <li><b>대표 승계</b> — 남은 행 중 id 최소(= 먼저 저장된 아이)가 {@code plan.pet_id} 가 된다</li>
 *   <li><b>마지막 한 마리는 남는다</b> — 동행견 0마리 일정을 만들지 않는다</li>
 * </ul>
 */
class PlanPetDetachProcessorTest {

    private static final long MEMBER_ID = 1L;
    private static final long DEAD_PET_ID = 9L;
    private static final long SECOND_DEAD_PET_ID = 11L;
    private static final long MONGSIL = 5L;
    private static final long BORI = 7L;
    private static final long KKORI = 8L;

    /** 잠금과 조회의 호출 순번. 순서가 레이스를 닫는 성질이라 데이터가 아니라 순서를 단언한다. */
    private List<String> callOrder;
    private FakePlanPetRepositoryPort planPetRepositoryPort;
    private FakePlanRepositoryPort planRepositoryPort;
    private PlanPetDetachProcessor processor;

    @BeforeEach
    void setUp() {
        callOrder = new ArrayList<>();
        planPetRepositoryPort = new FakePlanPetRepositoryPort(callOrder);
        planRepositoryPort = new FakePlanRepositoryPort(planPetRepositoryPort, callOrder);
        processor = new PlanPetDetachProcessor(planRepositoryPort, planPetRepositoryPort, new DirectTransactionManager());
    }

    // ── 대표 여부 × 남은 마리 수 ─────────────────────────────────────────────

    @Test
    @DisplayName("삭제된 아이가 대표이고 3마리면 — 행을 지우고 남은 행 중 id 최소를 대표로 올린다")
    void promotesTheOldestRemainingWhenTheRepresentativeIsGone() {
        givenPlan(101L, PlanStatus.DRAFT, DEAD_PET_ID);
        givenPlanPets(101L, DEAD_PET_ID, MONGSIL, BORI);

        PlanCompanionReconcileCounts counts = processor.detachPet(MEMBER_ID, DEAD_PET_ID);

        assertThat(petIdsOf(101L)).containsExactly(MONGSIL, BORI);
        assertThat(planRepositoryPort.plans.get(101L).petId()).isEqualTo(MONGSIL);
        assertThat(counts).isEqualTo(new PlanCompanionReconcileCounts(1, 1, 0, 0, 0));
    }

    @Test
    @DisplayName("삭제된 아이가 대표가 아니면 — 행만 지우고 대표는 그대로다")
    void keepsRepresentativeWhenAnotherCompanionIsRemoved() {
        givenPlan(101L, PlanStatus.CONFIRMED, MONGSIL);
        givenPlanPets(101L, MONGSIL, BORI, DEAD_PET_ID);

        PlanCompanionReconcileCounts counts = processor.detachPet(MEMBER_ID, DEAD_PET_ID);

        assertThat(petIdsOf(101L)).containsExactly(MONGSIL, BORI);
        assertThat(planRepositoryPort.plans.get(101L).petId()).isEqualTo(MONGSIL);
        assertThat(counts).isEqualTo(new PlanCompanionReconcileCounts(1, 0, 0, 0, 0));
    }

    @Test
    @DisplayName("두 마리 중 대표가 삭제되면 남은 한 마리가 대표가 된다")
    void promotesTheOnlyRemainingCompanion() {
        givenPlan(101L, PlanStatus.DRAFT, DEAD_PET_ID);
        givenPlanPets(101L, DEAD_PET_ID, KKORI);

        PlanCompanionReconcileCounts counts = processor.detachPet(MEMBER_ID, DEAD_PET_ID);

        assertThat(petIdsOf(101L)).containsExactly(KKORI);
        assertThat(planRepositoryPort.plans.get(101L).petId()).isEqualTo(KKORI);
        assertThat(counts).isEqualTo(new PlanCompanionReconcileCounts(1, 1, 0, 0, 0));
    }

    // ── R3: 마지막 한 마리는 떼어내지 않는다 ───────────────────────────────────

    @Test
    @DisplayName("한 마리뿐인 일정은 그 아이가 삭제됐어도 자리 표시자로 남는다 — 동행견 0마리 일정을 만들지 않는다")
    void keepsTheLastCompanionAsPlaceholder() {
        givenPlan(101L, PlanStatus.DRAFT, DEAD_PET_ID);
        givenPlanPets(101L, DEAD_PET_ID);

        PlanCompanionReconcileCounts counts = processor.detachPet(MEMBER_ID, DEAD_PET_ID);

        assertThat(petIdsOf(101L)).containsExactly(DEAD_PET_ID);
        assertThat(planRepositoryPort.plans.get(101L).petId()).isEqualTo(DEAD_PET_ID);
        assertThat(counts).isEqualTo(new PlanCompanionReconcileCounts(0, 0, 1, 0, 0));
    }

    @Test
    @DisplayName("조인 테이블 행이 없는 옛 일정은 R3 와 다른 수로 센다 — 지울 행 자체가 없었다")
    void countsLegacyPlanSeparatelyFromPlaceholder() {
        givenPlan(101L, PlanStatus.CONFIRMED, DEAD_PET_ID);

        PlanCompanionReconcileCounts counts = processor.detachPet(MEMBER_ID, DEAD_PET_ID);

        assertThat(petIdsOf(101L)).isEmpty();
        assertThat(planRepositoryPort.plans.get(101L).petId()).isEqualTo(DEAD_PET_ID);
        assertThat(counts).isEqualTo(PlanCompanionReconcileCounts.legacyPlanSkipped());
        assertThat(counts.placeholderKept()).isZero();
    }

    // ── 동시 실행 ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("트랜잭션 안의 재조회는 잠금 조회를 탄다 — 같은 일정을 처리하는 실행끼리 직렬화되는 근거다")
    void reloadsThePlanWithALock() {
        givenPlan(101L, PlanStatus.DRAFT, DEAD_PET_ID);
        givenPlanPets(101L, DEAD_PET_ID, MONGSIL);

        processor.detachPet(MEMBER_ID, DEAD_PET_ID);

        assertThat(planRepositoryPort.lockedReloads).isEqualTo(1);
        assertThat(planRepositoryPort.unlockedReloads).isZero();
    }

    @Test
    @DisplayName("일정 잠금이 plan_pet 조회보다 먼저다 — 순서가 레이스를 닫는 유일한 성질이다")
    void locksThePlanBeforeReadingCompanions() {
        givenPlan(101L, PlanStatus.DRAFT, DEAD_PET_ID);
        givenPlanPets(101L, DEAD_PET_ID, MONGSIL);

        processor.detachPet(MEMBER_ID, DEAD_PET_ID);

        assertThat(callOrder).containsExactly("lockPlan", "readPetsForUpdate");
    }

    @Test
    @DisplayName("잠금을 기다리는 사이 다른 실행이 한 마리를 이미 뗐으면 남은 한 마리는 R3 로 남긴다 — 동행견 0마리를 만들지 않는다")
    void keepsTheLastCompanionWhenAnotherRunAlreadyDetachedTheOther() {
        // 죽은 아이가 둘(A·B) 실린 일정을 두 실행이 나눠 맡은 상황이다. 우리가 맡은 쪽은 B 다.
        givenPlan(101L, PlanStatus.DRAFT, DEAD_PET_ID);
        givenPlanPets(101L, DEAD_PET_ID, SECOND_DEAD_PET_ID);
        // 대상 목록을 만든 뒤, 우리가 잠금을 얻기 직전에 앞 실행이 A 를 떼고 대표를 B 로 올린 채 커밋했다.
        planRepositoryPort.onLock = () -> {
            planPetRepositoryPort.rows.removeIf(row -> row.petId() == DEAD_PET_ID);
            planRepositoryPort.plans.computeIfPresent(101L,
                (id, plan) -> plan.toBuilder().petId(SECOND_DEAD_PET_ID).build());
        };

        PlanCompanionReconcileCounts counts = processor.detachPet(MEMBER_ID, SECOND_DEAD_PET_ID);

        // 잠금 뒤에 읽었으므로 [B] 를 본다. 잠금보다 먼저 읽었다면 [A, B] 를 보고 B 까지 지워 0행이 됐을 것이다.
        assertThat(petIdsOf(101L)).containsExactly(SECOND_DEAD_PET_ID);
        assertThat(counts).isEqualTo(new PlanCompanionReconcileCounts(0, 0, 1, 0, 0));
    }

    @Test
    @DisplayName("승계 직전에 대표가 바뀌었으면 덮어쓰지 않는다 — 사용자 수정이 이긴다")
    void doesNotOverwriteARepresentativeThatChangedMeanwhile() {
        givenPlan(101L, PlanStatus.DRAFT, DEAD_PET_ID);
        givenPlanPets(101L, DEAD_PET_ID, MONGSIL);
        planRepositoryPort.rejectPromotion = true;

        PlanCompanionReconcileCounts counts = processor.detachPet(MEMBER_ID, DEAD_PET_ID);

        // 행은 떼어내되 대표는 건드리지 않는다. 다음 회차가 불변식을 복구한다.
        assertThat(petIdsOf(101L)).containsExactly(MONGSIL);
        assertThat(planRepositoryPort.plans.get(101L).petId()).isEqualTo(DEAD_PET_ID);
        assertThat(counts).isEqualTo(new PlanCompanionReconcileCounts(1, 0, 0, 0, 0));
    }

    // ── R1: 완료 일정은 불가침 ────────────────────────────────────────────────

    @Test
    @DisplayName("완료된 일정은 대상에서 빠진다 — 다녀온 기록의 동행견은 사용자도 배치도 바꾸지 않는다")
    void neverTouchesCompletedPlans() {
        givenPlan(101L, PlanStatus.COMPLETED, DEAD_PET_ID);
        givenPlanPets(101L, DEAD_PET_ID, MONGSIL);

        PlanCompanionReconcileCounts counts = processor.detachPet(MEMBER_ID, DEAD_PET_ID);

        assertThat(petIdsOf(101L)).containsExactly(DEAD_PET_ID, MONGSIL);
        assertThat(counts).isEqualTo(PlanCompanionReconcileCounts.NONE);
    }

    @Test
    @DisplayName("대상 목록을 만든 뒤 완료로 넘어간 일정은 트랜잭션 안의 재확인에서 걸러진다")
    void rechecksStatusInsideTheTransaction() {
        givenPlan(101L, PlanStatus.COMPLETED, DEAD_PET_ID);
        givenPlanPets(101L, DEAD_PET_ID, MONGSIL);
        // 조회 시점에는 DRAFT 였던 일정이 목록으로 넘어온 상황을 흉내 낸다.
        planRepositoryPort.forcedTargets = List.of(planRepositoryPort.plans.get(101L).toBuilder().status(PlanStatus.DRAFT).build());

        PlanCompanionReconcileCounts counts = processor.detachPet(MEMBER_ID, DEAD_PET_ID);

        assertThat(petIdsOf(101L)).containsExactly(DEAD_PET_ID, MONGSIL);
        assertThat(counts).isEqualTo(PlanCompanionReconcileCounts.NONE);
    }

    @Test
    @DisplayName("삭제된 일정은 대상에서 빠진다")
    void skipsDeletedPlans() {
        givenPlan(101L, PlanStatus.DRAFT, DEAD_PET_ID, true);
        givenPlanPets(101L, DEAD_PET_ID, MONGSIL);

        PlanCompanionReconcileCounts counts = processor.detachPet(MEMBER_ID, DEAD_PET_ID);

        assertThat(petIdsOf(101L)).containsExactly(DEAD_PET_ID, MONGSIL);
        assertThat(counts).isEqualTo(PlanCompanionReconcileCounts.NONE);
    }

    // ── 불변식이 이미 깨진 일정 ────────────────────────────────────────────────

    @Test
    @DisplayName("대표가 조인 테이블 첫 행이 아니었으면 정리하면서 첫 행으로 복구한다")
    void repairsRepresentativeThatWasNotTheFirstRow() {
        givenPlan(101L, PlanStatus.DRAFT, DEAD_PET_ID);
        // 저장 순서는 몽실 → 삭제된 아이인데 대표가 뒤엣것을 가리키고 있다.
        givenPlanPets(101L, MONGSIL, DEAD_PET_ID);

        PlanCompanionReconcileCounts counts = processor.detachPet(MEMBER_ID, DEAD_PET_ID);

        assertThat(petIdsOf(101L)).containsExactly(MONGSIL);
        assertThat(planRepositoryPort.plans.get(101L).petId()).isEqualTo(MONGSIL);
        assertThat(counts).isEqualTo(new PlanCompanionReconcileCounts(1, 1, 0, 0, 0));
    }

    @Test
    @DisplayName("삭제된 아이가 plan.pet_id 에만 남아 있으면 지울 행 없이 대표만 복구한다")
    void repairsRepresentativeWhenTheJoinTableNeverCarriedTheDeadPet() {
        givenPlan(101L, PlanStatus.DRAFT, DEAD_PET_ID);
        givenPlanPets(101L, MONGSIL, BORI);

        PlanCompanionReconcileCounts counts = processor.detachPet(MEMBER_ID, DEAD_PET_ID);

        assertThat(petIdsOf(101L)).containsExactly(MONGSIL, BORI);
        assertThat(planRepositoryPort.plans.get(101L).petId()).isEqualTo(MONGSIL);
        assertThat(counts).isEqualTo(new PlanCompanionReconcileCounts(0, 1, 0, 0, 0));
    }

    // ── 여러 일정 · 멱등 ──────────────────────────────────────────────────────

    @Test
    @DisplayName("같은 회원의 여러 일정을 한 번에 정리하고, 다시 돌려도 아무것도 하지 않는다 (멱등)")
    void isIdempotentAcrossPlans() {
        givenPlan(101L, PlanStatus.DRAFT, DEAD_PET_ID);
        givenPlanPets(101L, DEAD_PET_ID, MONGSIL);
        givenPlan(102L, PlanStatus.CONFIRMED, MONGSIL);
        givenPlanPets(102L, MONGSIL, DEAD_PET_ID);

        PlanCompanionReconcileCounts first = processor.detachPet(MEMBER_ID, DEAD_PET_ID);
        PlanCompanionReconcileCounts second = processor.detachPet(MEMBER_ID, DEAD_PET_ID);

        assertThat(first).isEqualTo(new PlanCompanionReconcileCounts(2, 1, 0, 0, 0));
        assertThat(second).isEqualTo(PlanCompanionReconcileCounts.NONE);
        assertThat(petIdsOf(101L)).containsExactly(MONGSIL);
        assertThat(petIdsOf(102L)).containsExactly(MONGSIL);
    }

    @Test
    @DisplayName("남의 일정은 건드리지 않는다")
    void neverTouchesOtherMembersPlans() {
        givenPlan(101L, PlanStatus.DRAFT, DEAD_PET_ID, false, 99L);
        givenPlanPets(101L, DEAD_PET_ID, MONGSIL);

        PlanCompanionReconcileCounts counts = processor.detachPet(MEMBER_ID, DEAD_PET_ID);

        assertThat(petIdsOf(101L)).containsExactly(DEAD_PET_ID, MONGSIL);
        assertThat(counts).isEqualTo(PlanCompanionReconcileCounts.NONE);
    }

    @Test
    @DisplayName("일정 하나가 실패해도 나머지 일정은 계속 정리된다 — 한 일정이 회차를 말아먹지 않는다")
    void keepsGoingWhenOnePlanFails() {
        givenPlan(101L, PlanStatus.DRAFT, DEAD_PET_ID);
        givenPlanPets(101L, DEAD_PET_ID, MONGSIL);
        givenPlan(102L, PlanStatus.DRAFT, DEAD_PET_ID);
        givenPlanPets(102L, DEAD_PET_ID, BORI);
        planPetRepositoryPort.failingPlanId = 101L;

        PlanCompanionReconcileCounts counts = processor.detachPet(MEMBER_ID, DEAD_PET_ID);

        assertThat(counts).isEqualTo(new PlanCompanionReconcileCounts(1, 1, 0, 0, 0));
        assertThat(petIdsOf(102L)).containsExactly(BORI);
    }

    // ── 픽스처 ───────────────────────────────────────────────────────────────

    private void givenPlan(long planId, PlanStatus status, long petId) {
        givenPlan(planId, status, petId, false, MEMBER_ID);
    }

    private void givenPlan(long planId, PlanStatus status, long petId, boolean deleted) {
        givenPlan(planId, status, petId, deleted, MEMBER_ID);
    }

    private void givenPlan(long planId, PlanStatus status, long petId, boolean deleted, long memberId) {
        planRepositoryPort.plans.put(planId, Plan.builder()
            .id(planId).memberId(memberId).petId(petId).areaCode("39").title("일정 " + planId)
            .startDate(LocalDate.of(2026, 9, 12)).endDate(LocalDate.of(2026, 9, 14))
            .status(status).deleted(deleted)
            .build());
    }

    /** 인자 순서 = 저장 순서. id 오름차순이 저장 순서라는 전제를 픽스처가 그대로 흉내 낸다. */
    private void givenPlanPets(long planId, long... petIds) {
        long rowId = planId * 10;
        for (long petId : petIds) {
            planPetRepositoryPort.rows.add(PlanPet.builder().id(rowId++).planId(planId).petId(petId).build());
        }
    }

    private List<Long> petIdsOf(long planId) {
        return planPetRepositoryPort.petsOf(planId).stream().map(PlanPet::petId).toList();
    }

    // ── 페이크 ───────────────────────────────────────────────────────────────

    /** 트랜잭션 경계만 통과시키는 매니저. 이 테스트가 보는 것은 경계 자체가 아니라 그 안의 규칙이다. */
    private static final class DirectTransactionManager implements PlatformTransactionManager {

        @Override
        public TransactionStatus getTransaction(TransactionDefinition definition) {
            return new SimpleTransactionStatus();
        }

        @Override
        public void commit(TransactionStatus status) {
        }

        @Override
        public void rollback(TransactionStatus status) {
        }
    }

    private static final class FakePlanRepositoryPort implements PlanRepositoryPort {

        private final Map<Long, Plan> plans = new LinkedHashMap<>();
        private final FakePlanPetRepositoryPort planPets;
        private final List<String> callOrder;
        /** 조회와 처리 사이에 일정이 바뀐 상황을 흉내 낼 때만 쓴다. */
        private List<Plan> forcedTargets;
        /** 잠금 조회를 탔는지 센다 — 잠금 없는 재조회로 되돌아가면 이 수가 0이 된다. */
        private int lockedReloads;
        private int unlockedReloads;
        /** 승계 직전에 대표가 바뀐 상황(= 조건부 UPDATE 0건)을 흉내 낸다. */
        private boolean rejectPromotion;
        /** 잠금을 얻는 <b>바로 그 순간</b> 앞선 실행이 커밋한 것을 흉내 낸다. */
        private Runnable onLock;

        private FakePlanRepositoryPort(FakePlanPetRepositoryPort planPets, List<String> callOrder) {
            this.planPets = planPets;
            this.callOrder = callOrder;
        }

        @Override
        public Plan save(Plan plan) {
            throw new UnsupportedOperationException("배치는 일정 전체를 저장하지 않는다 — promoteRepresentative 만 쓴다");
        }

        @Override
        public Optional<Plan> findActiveById(long planId) {
            unlockedReloads++;
            return Optional.ofNullable(plans.get(planId)).filter(plan -> !plan.deleted());
        }

        @Override
        public Optional<Plan> findActiveByIdForUpdate(long planId) {
            lockedReloads++;
            callOrder.add("lockPlan");
            if (onLock != null) {
                // 잠금을 기다리는 동안 앞선 실행이 커밋했다 — 잠금 뒤의 조회는 그 결과를 봐야 한다.
                onLock.run();
            }
            return Optional.ofNullable(plans.get(planId)).filter(plan -> !plan.deleted());
        }

        @Override
        public int promoteRepresentative(long planId, long petId, long expectedPetId) {
            Plan plan = plans.get(planId);
            if (rejectPromotion || plan == null || plan.petId() != expectedPetId) {
                return 0;
            }
            plans.put(planId, plan.toBuilder().petId(petId).build());
            return 1;
        }

        @Override
        public Slice<Plan> findMyPlans(long memberId, Long petId, long lastPlanId, int size) {
            throw new UnsupportedOperationException();
        }

        @Override
        public List<Plan> findCompanionEditablePlansWithPet(long memberId, long petId) {
            if (forcedTargets != null) {
                return forcedTargets;
            }
            return plans.values().stream()
                .filter(plan -> plan.memberId() == memberId)
                .filter(plan -> !plan.deleted())
                .filter(plan -> plan.status().isCompanionEditable())
                .filter(plan -> plan.petId() == petId
                    || planPets.petsOf(plan.id()).stream().anyMatch(planPet -> planPet.petId() == petId))
                .toList();
        }

        @Override
        public List<Plan> findCompanionEditablePlans(long memberId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public List<Long> findMemberIdsWithCompanionEditablePlans(long lastMemberId, int size) {
            throw new UnsupportedOperationException();
        }
    }

    private static final class FakePlanPetRepositoryPort implements PlanPetRepositoryPort {

        private final List<PlanPet> rows = new ArrayList<>();
        private final List<String> callOrder;
        /** 이 일정의 삭제만 터뜨린다 — 일정 하나의 실패가 회차를 말아먹지 않는지 보기 위해서다. */
        private Long failingPlanId;

        private FakePlanPetRepositoryPort(List<String> callOrder) {
            this.callOrder = callOrder;
        }

        @Override
        public List<PlanPet> saveAll(List<PlanPet> pets) {
            throw new UnsupportedOperationException();
        }

        @Override
        public List<PlanPet> findByPlanId(long planId) {
            throw new UnsupportedOperationException("정리 경로는 잠금 조회를 쓴다");
        }

        @Override
        public List<PlanPet> findByPlanIdForUpdate(long planId) {
            callOrder.add("readPetsForUpdate");
            return petsOf(planId);
        }

        private List<PlanPet> petsOf(long planId) {
            return rows.stream()
                .filter(row -> row.planId() == planId)
                .sorted(Comparator.comparingLong(PlanPet::id))
                .toList();
        }

        @Override
        public List<PlanPet> findByPlanIds(Collection<Long> planIds) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void deleteByPlanId(long planId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public int deleteByPlanIdAndPetId(long planId, long petId) {
            if (failingPlanId != null && failingPlanId == planId) {
                throw new IllegalStateException("delete failed");
            }
            return rows.removeIf(row -> row.planId() == planId && row.petId() == petId) ? 1 : 0;
        }
    }
}
