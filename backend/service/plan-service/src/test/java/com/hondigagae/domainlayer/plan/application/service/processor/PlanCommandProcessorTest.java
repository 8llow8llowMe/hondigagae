package com.hondigagae.domainlayer.plan.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.plan.application.command.PlanCreateCommand;
import com.hondigagae.domainlayer.plan.application.exception.PlanErrorCode;
import com.hondigagae.domainlayer.plan.application.exception.PlanException;
import com.hondigagae.domainlayer.plan.application.port.out.PetConditionQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlaceVerifyQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanItemRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanPetRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.query.PetConditionQueryResult;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import com.hondigagae.domainlayer.plan.domain.model.PlanItem;
import com.hondigagae.domainlayer.plan.domain.model.PlanPet;
import com.hondigagae.persistence.util.SnowflakeIdGenerator;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Slice;

/**
 * 다견 담기 — 생성 시 반려견 결정 규칙 검증.
 *
 * <p>고정하는 것은 셋이다.
 * <ul>
 *   <li><b>대표 반려견은 첫 번째다</b> — {@code plan.petId} 와 조인 테이블 첫 행이 같아야 옛 경로와 새 경로가 같은 답을 낸다
 *   <li><b>지정이 없으면 대표 반려견이다</b> — ai-service 생성과 같은 규칙. 그것도 없으면 만들지 않는다
 *   <li><b>대표 반려견 조회는 지정이 없을 때만 부른다</b> — 매 담기마다 auth-service 를 왕복하지 않는다
 * </ul>
 */
class PlanCommandProcessorTest {

    private static final long MEMBER_ID = 1L;
    private static final long REPRESENTATIVE_PET_ID = 77L;

    private StubPlanRepositoryPort planRepositoryPort;
    private StubPlanPetRepositoryPort planPetRepositoryPort;
    private StubPetConditionQueryPort petConditionQueryPort;
    private PlanCommandProcessor processor;

    @BeforeEach
    void setUp() {
        planRepositoryPort = new StubPlanRepositoryPort();
        planPetRepositoryPort = new StubPlanPetRepositoryPort();
        petConditionQueryPort = new StubPetConditionQueryPort();
        processor = new PlanCommandProcessor(
            planRepositoryPort, new StubPlanItemRepositoryPort(), planPetRepositoryPort,
            new StubPlaceVerifyQueryPort(), petConditionQueryPort, new SnowflakeIdGenerator(1, 1));
    }

    private static PlanCreateCommand command(List<Long> petIds) {
        return PlanCreateCommand.builder()
            .petIds(petIds)
            .areaCode("39")
            .title("몽실이와 제주 2박 3일")
            .startDate(LocalDate.of(2026, 9, 12))
            .endDate(LocalDate.of(2026, 9, 14))
            .items(List.of())
            .build();
    }

    @Test
    @DisplayName("여러 마리를 지정하면 첫 번째가 대표 반려견이 되고, 전체는 조인 테이블에 순서대로 저장된다")
    void firstPetBecomesRepresentative() {
        Plan saved = processor.createPlan(MEMBER_ID, command(List.of(2L, 5L, 9L)));

        assertThat(saved.petId()).isEqualTo(2L);
        assertThat(planPetRepositoryPort.saved).extracting(PlanPet::petId).containsExactly(2L, 5L, 9L);
        assertThat(planPetRepositoryPort.saved).allMatch(pet -> pet.planId() == saved.id());
        // 조인 테이블 첫 행 = 대표 반려견. 옛 일정(행 없음)과 새 일정이 같은 대표를 가리켜야 한다.
        assertThat(planPetRepositoryPort.saved.get(0).petId()).isEqualTo(saved.petId());
    }

    @Test
    @DisplayName("한 마리 지정도 조인 테이블에 남긴다 — 한 마리 일정과 여러 마리 일정을 같은 경로로 읽는다")
    void singlePetIsAlsoStoredInJoinTable() {
        Plan saved = processor.createPlan(MEMBER_ID, command(List.of(2L)));

        assertThat(saved.petId()).isEqualTo(2L);
        assertThat(planPetRepositoryPort.saved).extracting(PlanPet::petId).containsExactly(2L);
    }

    @Test
    @DisplayName("반려견을 지정하지 않으면 대표 반려견으로 만든다 — ai-service 생성과 같은 규칙")
    void fallsBackToRepresentativePet() {
        petConditionQueryPort.representativePetId = REPRESENTATIVE_PET_ID;

        Plan saved = processor.createPlan(MEMBER_ID, command(List.of()));

        assertThat(saved.petId()).isEqualTo(REPRESENTATIVE_PET_ID);
        assertThat(planPetRepositoryPort.saved).extracting(PlanPet::petId).containsExactly(REPRESENTATIVE_PET_ID);
    }

    @Test
    @DisplayName("지정도 없고 대표 반려견도 없으면 400 PET_REQUIRED — 반려견 없는 일정은 만들지 않는다")
    void rejectsWhenNoPetAtAll() {
        petConditionQueryPort.representativePetId = null;

        assertThatThrownBy(() -> processor.createPlan(MEMBER_ID, command(List.of())))
            .isInstanceOf(PlanException.class)
            .extracting(exception -> ((PlanException) exception).getErrorCode())
            .isEqualTo(PlanErrorCode.PET_REQUIRED);
        assertThat(planRepositoryPort.saved).isNull();
    }

    @Test
    @DisplayName("반려견을 지정했으면 대표 반려견을 묻지 않는다 — 담기마다 auth-service 를 왕복하지 않는다")
    void doesNotAskRepresentativeWhenSpecified() {
        processor.createPlan(MEMBER_ID, command(List.of(2L)));

        assertThat(petConditionQueryPort.representativeCalls).isZero();
    }

    // ── 스텁 ───────────────────────────────────────────────────────────────

    private static class StubPlanRepositoryPort implements PlanRepositoryPort {

        private Plan saved;

        @Override
        public Plan save(Plan plan) {
            saved = plan;
            return plan;
        }

        @Override
        public Optional<Plan> findActiveById(long planId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public Slice<Plan> findMyPlans(long memberId, Long petId, long lastPlanId, int size) {
            throw new UnsupportedOperationException();
        }
    }

    private static class StubPlanPetRepositoryPort implements PlanPetRepositoryPort {

        private final List<PlanPet> saved = new ArrayList<>();

        @Override
        public List<PlanPet> saveAll(List<PlanPet> pets) {
            saved.addAll(pets);
            return pets;
        }

        @Override
        public List<PlanPet> findByPlanId(long planId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public List<PlanPet> findByPlanIds(Collection<Long> planIds) {
            throw new UnsupportedOperationException();
        }
    }

    private static class StubPetConditionQueryPort implements PetConditionQueryPort {

        private Long representativePetId;
        private int representativeCalls;

        @Override
        public Map<Long, PetConditionQueryResult> findConditions(long memberId, List<Long> petIds) {
            throw new UnsupportedOperationException();
        }

        @Override
        public Optional<Long> findRepresentativePetId(long memberId) {
            representativeCalls += 1;
            return Optional.ofNullable(representativePetId);
        }
    }

    private static class StubPlanItemRepositoryPort implements PlanItemRepositoryPort {

        @Override
        public List<PlanItem> saveAll(List<PlanItem> items) {
            return items;
        }

        @Override
        public List<PlanItem> findByPlanId(long planId) {
            return List.of();
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

    private static class StubPlaceVerifyQueryPort implements PlaceVerifyQueryPort {

        @Override
        public Set<Long> findVisiblePlaceIds(Collection<Long> placeIds) {
            return new HashSet<>(placeIds);
        }
    }
}
