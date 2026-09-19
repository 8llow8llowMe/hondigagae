package com.hondigagae.domainlayer.plan.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.plan.application.exception.PlanErrorCode;
import com.hondigagae.domainlayer.plan.application.exception.PlanException;
import com.hondigagae.domainlayer.plan.application.model.PlanCompanionReconcileCounts;
import com.hondigagae.domainlayer.plan.application.port.out.PetConditionQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanPetRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.query.PetConditionQueryResult;
import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import com.hondigagae.domainlayer.plan.domain.model.PlanPet;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Slice;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;

/**
 * 회원 한 명의 동행견 대사 (#720).
 *
 * <p>정리 규칙 자체는 {@link PlanPetDetachProcessorTest} 가 본다. 여기서 고정하는 것은
 * <b>무엇을 물어보고 무엇을 믿는가</b>다.
 * <ul>
 *   <li>대표 컬럼과 조인 테이블에 실린 아이를 모아 <b>한 번에</b> 묻는다 (일정마다 묻지 않는다)</li>
 *   <li>auth-service 가 <b>503</b>이면 예외를 그대로 올린다 — 응답을 못 받은 것을 "전부 삭제됨"
 *       으로 읽으면 멀쩡한 동행견을 떼어낸다. 호출부가 실패로 세고, 연속되면 회차를 멈춘다</li>
 *   <li>반대로 <b>빈 목록 200 은 그대로 믿고 정리한다</b> — auth 의 조회가 요청 petIds 와의
 *       교집합이라 "요청한 아이가 전부 삭제됨" 이 곧 빈 목록이고, 그게 바로 정리 대상이다.
 *       여기서 회원을 건너뛰면 #720 증상이 그대로 남는다</li>
 * </ul>
 */
class PlanCompanionReconcileProcessorTest {

    private static final long MEMBER_ID = 1L;
    private static final long MONGSIL = 5L;
    private static final long BORI = 7L;
    private static final long DEAD_PET_ID = 9L;

    private FakePlanPetRepositoryPort planPetRepositoryPort;
    private FakePlanRepositoryPort planRepositoryPort;
    private StubPetConditionQueryPort petConditionQueryPort;
    private PlanCompanionReconcileProcessor processor;

    @BeforeEach
    void setUp() {
        planPetRepositoryPort = new FakePlanPetRepositoryPort();
        planRepositoryPort = new FakePlanRepositoryPort(planPetRepositoryPort);
        petConditionQueryPort = new StubPetConditionQueryPort();
        processor = new PlanCompanionReconcileProcessor(planRepositoryPort, planPetRepositoryPort, petConditionQueryPort,
            new PlanPetDetachProcessor(planRepositoryPort, planPetRepositoryPort, new DirectTransactionManager()));
    }

    @Test
    @DisplayName("원천에 없는 아이만 떼어낸다 — 살아 있는 아이는 그대로 둔다")
    void detachesOnlyPetsThatAreGoneFromTheSource() {
        givenPlan(101L, PlanStatus.DRAFT, MONGSIL);
        givenPlanPets(101L, MONGSIL, DEAD_PET_ID, BORI);
        petConditionQueryPort.ownedPetIds = Set.of(MONGSIL, BORI);

        PlanCompanionReconcileCounts counts = processor.reconcileMember(MEMBER_ID);

        assertThat(petIdsOf(101L)).containsExactly(MONGSIL, BORI);
        // 마지막 1 은 auth-service 왕복 수 — 회원당 한 번이라는 구조를 여기서도 고정한다.
        assertThat(counts).isEqualTo(new PlanCompanionReconcileCounts(1, 0, 0, 0, 1));
    }

    @Test
    @DisplayName("대표 컬럼과 조인 테이블에 실린 아이를 모아 한 번에 묻는다 — 일정마다 왕복하지 않는다")
    void asksOnceForEveryReferencedPet() {
        givenPlan(101L, PlanStatus.DRAFT, MONGSIL);
        givenPlanPets(101L, MONGSIL, BORI);
        givenPlan(102L, PlanStatus.CONFIRMED, DEAD_PET_ID);   // 조인 테이블 행이 없는 옛 일정
        petConditionQueryPort.ownedPetIds = Set.of(MONGSIL, BORI, DEAD_PET_ID);

        processor.reconcileMember(MEMBER_ID);

        assertThat(petConditionQueryPort.requests).hasSize(1);
        assertThat(petConditionQueryPort.requests.get(0)).containsExactlyInAnyOrder(MONGSIL, DEAD_PET_ID, BORI);
    }

    @Test
    @DisplayName("완료된 일정에만 실린 아이는 애초에 묻지 않는다 — 완료 일정은 정리 대상이 아니다")
    void ignoresPetsThatOnlyCompletedPlansCarry() {
        givenPlan(101L, PlanStatus.DRAFT, MONGSIL);
        givenPlanPets(101L, MONGSIL);
        givenPlan(102L, PlanStatus.COMPLETED, DEAD_PET_ID);
        givenPlanPets(102L, DEAD_PET_ID);
        petConditionQueryPort.ownedPetIds = Set.of(MONGSIL);

        PlanCompanionReconcileCounts counts = processor.reconcileMember(MEMBER_ID);

        assertThat(petConditionQueryPort.requests.get(0)).containsExactly(MONGSIL);
        assertThat(petIdsOf(102L)).containsExactly(DEAD_PET_ID);
        assertThat(counts).isEqualTo(PlanCompanionReconcileCounts.remoteCall());
    }

    @Test
    @DisplayName("auth-service 조회가 503 이면 예외를 그대로 올린다 — 못 받은 응답을 '전부 삭제됨' 으로 읽지 않는다")
    void propagatesLookupFailure() {
        givenPlan(101L, PlanStatus.DRAFT, MONGSIL);
        givenPlanPets(101L, MONGSIL, DEAD_PET_ID);
        petConditionQueryPort.failure = new PlanException(PlanErrorCode.INTERNAL_SERVICE_UNAVAILABLE);

        assertThatThrownBy(() -> processor.reconcileMember(MEMBER_ID))
            .isInstanceOf(PlanException.class)
            .extracting(exception -> ((PlanException) exception).getErrorCode())
            .isEqualTo(PlanErrorCode.INTERNAL_SERVICE_UNAVAILABLE);
        assertThat(petIdsOf(101L)).containsExactly(MONGSIL, DEAD_PET_ID);
    }

    @Test
    @DisplayName("요청한 아이가 전부 삭제된 회원도 정상 정리된다 — 빈 목록 200 은 '전부 삭제됨' 이라는 정상 답이다")
    void cleansUpAMemberWhoseEveryPetIsGone() {
        // auth 의 조회는 요청 petIds 와의 교집합을 낸다. 소유한 아이가 하나도 없으면 빈 목록 200 이
        // 오고, 그게 바로 정리 대상이다. 여기서 회원을 건너뛰면 #720 증상이 그대로 남는다.
        givenPlan(101L, PlanStatus.DRAFT, DEAD_PET_ID);
        givenPlanPets(101L, DEAD_PET_ID, BORI);
        petConditionQueryPort.ownedPetIds = Set.of();

        PlanCompanionReconcileCounts counts = processor.reconcileMember(MEMBER_ID);

        // 두 마리 다 죽었어도 R3 가 마지막 한 마리를 지킨다 — 하나는 떼어내고 하나는 자리 표시자로 남는다.
        assertThat(petIdsOf(101L)).containsExactly(BORI);
        assertThat(counts.detached()).isEqualTo(1);
        assertThat(counts.placeholderKept()).isEqualTo(1);
        assertThat(counts.remoteCalls()).isEqualTo(1);
    }

    @Test
    @DisplayName("정리할 일정이 없는 회원은 원천을 묻지도 않는다")
    void doesNotAskWhenTheMemberHasNoEditablePlan() {
        givenPlan(101L, PlanStatus.COMPLETED, MONGSIL);

        PlanCompanionReconcileCounts counts = processor.reconcileMember(MEMBER_ID);

        assertThat(petConditionQueryPort.requests).isEmpty();
        assertThat(counts).isEqualTo(PlanCompanionReconcileCounts.NONE);
    }

    @Test
    @DisplayName("다시 돌려도 결과가 같다 — 두 번째 회차는 아무것도 하지 않는다 (멱등)")
    void isIdempotent() {
        givenPlan(101L, PlanStatus.DRAFT, DEAD_PET_ID);
        givenPlanPets(101L, DEAD_PET_ID, MONGSIL);
        petConditionQueryPort.ownedPetIds = Set.of(MONGSIL);

        PlanCompanionReconcileCounts first = processor.reconcileMember(MEMBER_ID);
        PlanCompanionReconcileCounts second = processor.reconcileMember(MEMBER_ID);

        assertThat(first).isEqualTo(new PlanCompanionReconcileCounts(1, 1, 0, 0, 1));
        // 두 번째 회차는 물어보기만 하고 아무것도 바꾸지 않는다.
        assertThat(second).isEqualTo(PlanCompanionReconcileCounts.remoteCall());
        assertThat(petIdsOf(101L)).containsExactly(MONGSIL);
    }

    // ── 픽스처 ───────────────────────────────────────────────────────────────

    private void givenPlan(long planId, PlanStatus status, long petId) {
        planRepositoryPort.plans.put(planId, Plan.builder()
            .id(planId).memberId(MEMBER_ID).petId(petId).areaCode("39").title("일정 " + planId)
            .startDate(LocalDate.of(2026, 9, 12)).endDate(LocalDate.of(2026, 9, 14))
            .status(status).deleted(false)
            .build());
    }

    private void givenPlanPets(long planId, long... petIds) {
        long rowId = planId * 10;
        for (long petId : petIds) {
            planPetRepositoryPort.rows.add(PlanPet.builder().id(rowId++).planId(planId).petId(petId).build());
        }
    }

    private List<Long> petIdsOf(long planId) {
        return planPetRepositoryPort.findByPlanId(planId).stream().map(PlanPet::petId).toList();
    }

    // ── 페이크 ───────────────────────────────────────────────────────────────

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

        private FakePlanRepositoryPort(FakePlanPetRepositoryPort planPets) {
            this.planPets = planPets;
        }

        @Override
        public Plan save(Plan plan) {
            throw new UnsupportedOperationException("배치는 일정 전체를 저장하지 않는다");
        }

        @Override
        public Optional<Plan> findActiveById(long planId) {
            throw new UnsupportedOperationException("정리 경로는 잠금 조회를 쓴다");
        }

        @Override
        public Optional<Plan> findActiveByIdForUpdate(long planId) {
            return Optional.ofNullable(plans.get(planId)).filter(plan -> !plan.deleted());
        }

        @Override
        public int promoteRepresentative(long planId, long petId, long expectedPetId) {
            Plan plan = plans.get(planId);
            if (plan == null || plan.petId() != expectedPetId) {
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
            return findCompanionEditablePlans(memberId).stream()
                .filter(plan -> plan.petId() == petId
                    || planPets.findByPlanId(plan.id()).stream().anyMatch(planPet -> planPet.petId() == petId))
                .toList();
        }

        @Override
        public List<Plan> findCompanionEditablePlans(long memberId) {
            return plans.values().stream()
                .filter(plan -> plan.memberId() == memberId)
                .filter(plan -> !plan.deleted())
                .filter(plan -> plan.status().isCompanionEditable())
                .toList();
        }

        @Override
        public List<Long> findMemberIdsWithCompanionEditablePlans(long lastMemberId, int size) {
            throw new UnsupportedOperationException();
        }
    }

    private static final class FakePlanPetRepositoryPort implements PlanPetRepositoryPort {

        private final List<PlanPet> rows = new ArrayList<>();

        @Override
        public List<PlanPet> saveAll(List<PlanPet> pets) {
            throw new UnsupportedOperationException();
        }

        @Override
        public List<PlanPet> findByPlanId(long planId) {
            return rows.stream()
                .filter(row -> row.planId() == planId)
                .sorted(Comparator.comparingLong(PlanPet::id))
                .toList();
        }

        @Override
        public List<PlanPet> findByPlanIdForUpdate(long planId) {
            return findByPlanId(planId);
        }

        @Override
        public List<PlanPet> findByPlanIds(Collection<Long> planIds) {
            return rows.stream()
                .filter(row -> planIds.contains(row.planId()))
                .sorted(Comparator.comparingLong(PlanPet::id))
                .toList();
        }

        @Override
        public void deleteByPlanId(long planId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public int deleteByPlanIdAndPetId(long planId, long petId) {
            return rows.removeIf(row -> row.planId() == planId && row.petId() == petId) ? 1 : 0;
        }
    }

    private static final class StubPetConditionQueryPort implements PetConditionQueryPort {

        private final List<List<Long>> requests = new ArrayList<>();
        private Set<Long> ownedPetIds = new HashSet<>();
        private PlanException failure;

        @Override
        public Map<Long, PetConditionQueryResult> findConditions(long memberId, List<Long> petIds) {
            throw new UnsupportedOperationException();
        }

        @Override
        public Optional<Long> findRepresentativePetId(long memberId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public Set<Long> findOwnedPetIds(long memberId, List<Long> petIds) {
            requests.add(List.copyOf(petIds));
            if (failure != null) {
                throw failure;
            }
            return ownedPetIds;
        }
    }
}
