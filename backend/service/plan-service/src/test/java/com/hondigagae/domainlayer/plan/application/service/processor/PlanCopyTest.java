package com.hondigagae.domainlayer.plan.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.plan.application.command.PlanCopyCommand;
import com.hondigagae.domainlayer.plan.application.exception.PlanErrorCode;
import com.hondigagae.domainlayer.plan.application.exception.PlanException;
import com.hondigagae.domainlayer.plan.application.port.out.PetConditionQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlaceVerifyQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanItemRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanPetRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.query.PetConditionQueryResult;
import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import com.hondigagae.domainlayer.plan.domain.model.PlanItem;
import com.hondigagae.domainlayer.plan.domain.model.PlanPet;
import com.hondigagae.persistence.util.SnowflakeIdGenerator;
import com.hondigagae.shared.travel.plan.PlanItemType;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Slice;

/**
 * 지난 일정 복제 (#616).
 *
 * <p>복제는 새 기록이다 — 방문 체크·준비물·후기는 가져오지 않고, delisted 장소도 항목은 남긴다.
 */
class PlanCopyTest {

    private static final long MEMBER_ID = 1L;
    private static final long SOURCE_PLAN_ID = 100L;
    private static final LocalDate SOURCE_START = LocalDate.of(2026, 9, 12);
    private static final LocalDate NEW_START = LocalDate.of(2027, 5, 1);

    @Test
    @DisplayName("항목과 동행 반려견을 복사하고 visited 는 false 로 초기화한다")
    void copiesItemsWithVisitedReset() {
        StubPlanItemRepositoryPort items = new StubPlanItemRepositoryPort(
            visitedItem(1, 10L, true),
            visitedItem(2, 20L, true));
        StubPlanPetRepositoryPort pets = new StubPlanPetRepositoryPort();
        StubPlanRepositoryPort plans = new StubPlanRepositoryPort();
        StubPetConditionQueryPort petPort = new StubPetConditionQueryPort(Set.of(2L, 5L));
        PlanCommandProcessor processor = processor(plans, items, pets, petPort);

        Plan copied = processor.copyPlan(
            sourcePlan(3), copyCommand(null, NEW_START), List.of(2L, 5L), items.items);

        assertThat(copied.id()).isNotEqualTo(SOURCE_PLAN_ID);
        assertThat(copied.status()).isEqualTo(PlanStatus.DRAFT);
        assertThat(copied.title()).isEqualTo("몽실이와 제주 2박 3일 (복사)");
        assertThat(copied.startDate()).isEqualTo(NEW_START);
        assertThat(copied.endDate()).isEqualTo(NEW_START.plusDays(2));
        assertThat(pets.saved).extracting(PlanPet::petId).containsExactly(2L, 5L);
        assertThat(items.saved).hasSize(2);
        assertThat(items.saved).allMatch(item -> !item.visited());
        assertThat(items.saved).extracting(PlanItem::planId).containsOnly(copied.id());
        assertThat(items.saved).extracting(PlanItem::id).doesNotContain(10L, 20L);
    }

    @Test
    @DisplayName("요청 제목이 있으면 접미사 대신 그 제목을 쓴다")
    void usesRequestedTitle() {
        StubPlanItemRepositoryPort items = new StubPlanItemRepositoryPort();
        PlanCommandProcessor processor = processor(new StubPlanRepositoryPort(), items,
            new StubPlanPetRepositoryPort(), new StubPetConditionQueryPort(Set.of(7L)));

        Plan copied = processor.copyPlan(
            sourcePlan(3), copyCommand("다시 가는 제주", NEW_START), List.of(7L), List.of());

        assertThat(copied.title()).isEqualTo("다시 가는 제주");
    }

    @Test
    @DisplayName("일수가 원본과 다르면 400 PLAN_021 로 거부한다")
    void rejectsMismatchedPeriodLength() {
        PlanCommandProcessor processor = processor(new StubPlanRepositoryPort(), new StubPlanItemRepositoryPort(),
            new StubPlanPetRepositoryPort(), new StubPetConditionQueryPort(Set.of(7L)));

        assertThatThrownBy(() -> processor.copyPlan(
            sourcePlan(3), copyCommand(null, NEW_START, NEW_START.plusDays(1)), List.of(7L), List.of()))
            .isInstanceOf(PlanException.class)
            .hasFieldOrPropertyWithValue("errorCode", PlanErrorCode.PLAN_COPY_PERIOD_MISMATCH);
    }

    @Test
    @DisplayName("소유하지 않은 반려견은 빼고 남은 아이만 복제한다")
    void filtersOutUnownedPets() {
        StubPlanPetRepositoryPort pets = new StubPlanPetRepositoryPort();
        StubPetConditionQueryPort petPort = new StubPetConditionQueryPort(Set.of(2L));
        PlanCommandProcessor processor = processor(new StubPlanRepositoryPort(), new StubPlanItemRepositoryPort(),
            pets, petPort);

        List<Long> petIds = processor.resolveCopyPetIds(MEMBER_ID, List.of(2L, 999L));
        processor.copyPlan(sourcePlan(3), copyCommand(null, NEW_START), petIds, List.of());

        assertThat(pets.saved).extracting(PlanPet::petId).containsExactly(2L);
    }

    @Test
    @DisplayName("남은 동행 반려견이 없으면 400 PET_REQUIRED 이다")
    void rejectsWhenNoOwnedPetsRemain() {
        StubPetConditionQueryPort petPort = new StubPetConditionQueryPort(Set.of());
        PlanCommandProcessor processor = processor(new StubPlanRepositoryPort(), new StubPlanItemRepositoryPort(),
            new StubPlanPetRepositoryPort(), petPort);

        assertThatThrownBy(() -> processor.resolveCopyPetIds(MEMBER_ID, List.of(2L, 5L)))
            .isInstanceOf(PlanException.class)
            .hasFieldOrPropertyWithValue("errorCode", PlanErrorCode.PET_REQUIRED);
    }

    private static Plan sourcePlan(int totalDays) {
        return Plan.builder()
            .id(SOURCE_PLAN_ID)
            .memberId(MEMBER_ID)
            .petId(2L)
            .areaCode("39")
            .sigunguCode("4")
            .title("몽실이와 제주 2박 3일")
            .startDate(SOURCE_START)
            .endDate(SOURCE_START.plusDays(totalDays - 1L))
            .budget(400_000)
            .status(PlanStatus.COMPLETED)
            .deleted(false)
            .build();
    }

    private static PlanCopyCommand copyCommand(String title, LocalDate start) {
        return copyCommand(title, start, start.plusDays(2));
    }

    private static PlanCopyCommand copyCommand(String title, LocalDate start, LocalDate end) {
        return PlanCopyCommand.builder()
            .title(title)
            .startDate(start)
            .endDate(end)
            .build();
    }

    private static PlanItem visitedItem(int day, long itemId, boolean visited) {
        return PlanItem.builder()
            .id(itemId)
            .planId(SOURCE_PLAN_ID)
            .day(day)
            .sequence(1)
            .itemType(PlanItemType.PLACE)
            .targetId(itemId * 100)
            .title("항목 " + day)
            .visited(visited)
            .build();
    }

    private PlanCommandProcessor processor(
        StubPlanRepositoryPort plans,
        StubPlanItemRepositoryPort items,
        StubPlanPetRepositoryPort pets,
        StubPetConditionQueryPort petPort
    ) {
        return new PlanCommandProcessor(
            plans, items, pets, new StubPlaceVerifyQueryPort(), petPort, new SnowflakeIdGenerator(1, 1));
    }

    private static class StubPlanRepositoryPort implements PlanRepositoryPort {

        @Override
        public Plan save(Plan plan) {
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

    private static class StubPlanItemRepositoryPort implements PlanItemRepositoryPort {

        private final List<PlanItem> items;
        private final List<PlanItem> saved = new ArrayList<>();

        private StubPlanItemRepositoryPort(PlanItem... items) {
            this.items = List.of(items);
        }

        @Override
        public List<PlanItem> findByPlanId(long planId) {
            return items;
        }

        @Override
        public List<PlanItem> saveAll(List<PlanItem> saving) {
            saved.addAll(saving);
            return saving;
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

        @Override
        public void deleteByPlanId(long planId) {
            throw new UnsupportedOperationException();
        }
    }

    private static class StubPetConditionQueryPort implements PetConditionQueryPort {

        private final Set<Long> ownedPetIds;

        private StubPetConditionQueryPort(Set<Long> ownedPetIds) {
            this.ownedPetIds = ownedPetIds;
        }

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
            return new HashSet<>(ownedPetIds);
        }
    }

    private static class StubPlaceVerifyQueryPort implements PlaceVerifyQueryPort {

        @Override
        public Set<Long> findVisiblePlaceIds(Collection<Long> placeIds) {
            return new HashSet<>(placeIds);
        }
    }
}
