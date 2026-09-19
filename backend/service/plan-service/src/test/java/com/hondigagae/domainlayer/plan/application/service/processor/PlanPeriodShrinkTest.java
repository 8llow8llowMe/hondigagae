package com.hondigagae.domainlayer.plan.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.plan.application.command.PlanUpdateCommand;
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
 * 기간을 줄일 때 범위 밖 항목을 어떻게 다루는가 (#87).
 *
 * <p>고아 항목이 남으면 <b>상세 응답과 날씨 브리핑이 어긋난다</b> — {@code totalDays=2} 인
 * 일정에 {@code day=3} 항목이 섞여 오는데, 그 항목은 일자별 교체 경로가 {@code PLAN_002} 로
 * 막아 지울 수단조차 없다.
 *
 * <p>이 저장소의 선택은 <b>거부</b>다. 자동 삭제는 사용자의 기록을 말없이 지우는 일이라
 * 하지 않는다. 어느 쪽이든 고를 수 있었던 자리라서, 고른 쪽을 테스트로 고정한다 —
 * 없으면 다음 사람이 "조용히 지우는 편이 친절하다"며 반대로 바꾸기 쉽다.
 */
class PlanPeriodShrinkTest {

    private static final long PLAN_ID = 100L;
    private static final LocalDate START = LocalDate.of(2026, 9, 12);

    @Test
    @DisplayName("기간을 줄여 범위 밖 항목이 남으면 400 PLAN_008 로 거부한다")
    void rejectsShrinkWhenItemsFallOutOfRange() {
        // 3일 일정의 3일차에 항목이 있는데 2일로 줄이려는 상황. 이슈의 재현 조건 그대로다.
        StubPlanItemRepositoryPort items = new StubPlanItemRepositoryPort(item(3));
        PlanCommandProcessor processor = processor(items);

        assertThatThrownBy(() -> processor.updatePlan(plan(3), shrinkTo(2), null, null))
            .isInstanceOf(PlanException.class)
            .hasFieldOrPropertyWithValue("errorCode", PlanErrorCode.PLAN_PERIOD_SHRINK_CONFLICT);
    }

    @Test
    @DisplayName("거부되면 기간도 저장되지 않는다")
    void doesNotPersistRejectedShrink() {
        // 검사가 저장 뒤에 있으면 기간만 줄어든 채로 고아가 남는다 - 이슈가 보고한 상태와 같아진다.
        StubPlanItemRepositoryPort items = new StubPlanItemRepositoryPort(item(3));
        StubPlanRepositoryPort plans = new StubPlanRepositoryPort();
        PlanCommandProcessor processor = processor(plans, items);

        assertThatThrownBy(() -> processor.updatePlan(plan(3), shrinkTo(2), null, null))
            .isInstanceOf(PlanException.class);

        assertThat(plans.saved).isNull();
    }

    @Test
    @DisplayName("마지막 일차까지만 항목이 있으면 그만큼은 줄일 수 있다")
    void allowsShrinkDownToTheLastUsedDay() {
        // 경계다. day > totalDays 가 아니라 day >= totalDays 로 잘못 쓰면 여기서 걸린다 -
        // 2일차 항목만 있는 3일 일정을 2일로 줄이는 것은 막을 이유가 없다.
        PlanCommandProcessor processor = processor(new StubPlanItemRepositoryPort(item(1), item(2)));

        assertThatCode(() -> processor.updatePlan(plan(3), shrinkTo(2), null, null)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("기간을 늘릴 때는 항목을 보지 않는다")
    void doesNotCheckItemsWhenPeriodGrows() {
        // 늘리면 기존 항목은 모두 범위 안에 남는다. 굳이 항목을 읽으면 헛된 쿼리다.
        StubPlanItemRepositoryPort items = new StubPlanItemRepositoryPort(item(3));
        PlanCommandProcessor processor = processor(items);

        assertThatCode(() -> processor.updatePlan(plan(3), shrinkTo(5), null, null)).doesNotThrowAnyException();
        assertThat(items.lookups).isZero();
    }

    @Test
    @DisplayName("제목만 바꿀 때는 항목을 조회하지 않는다")
    void doesNotCheckItemsWhenPeriodIsUntouched() {
        StubPlanItemRepositoryPort items = new StubPlanItemRepositoryPort(item(3));
        PlanCommandProcessor processor = processor(items);

        processor.updatePlan(plan(3), PlanUpdateCommand.builder().title("제목만 바꾼다").build(), null, null);

        assertThat(items.lookups).isZero();
    }

    @Test
    @DisplayName("시작일을 미뤄 기간이 줄어드는 것도 같은 검사를 받는다")
    void alsoChecksWhenStartDateMovesForward() {
        // 끝나는 날만 당기는 것이 아니라 시작일을 미뤄도 일수는 줄어든다. 한쪽만 보면
        // 프론트가 시작일 편집을 여는 순간 다시 고아가 생긴다.
        StubPlanItemRepositoryPort items = new StubPlanItemRepositoryPort(item(3));
        PlanCommandProcessor processor = processor(items);

        PlanUpdateCommand command = PlanUpdateCommand.builder().startDate(START.plusDays(1)).build();

        assertThatThrownBy(() -> processor.updatePlan(plan(3), command, null, null))
            .isInstanceOf(PlanException.class)
            .hasFieldOrPropertyWithValue("errorCode", PlanErrorCode.PLAN_PERIOD_SHRINK_CONFLICT);
    }

    // 픽스처 ──────────────────────────────────────────────────────────────

    /** {@code totalDays} 일짜리 일정. 시작일을 고정해 두어 일수만 바뀌게 한다. */
    private static Plan plan(int totalDays) {
        return Plan.builder()
            .id(PLAN_ID)
            .memberId(1L)
            .petId(7L)
            .areaCode("39")
            .title("몽실이와 제주")
            .startDate(START)
            .endDate(START.plusDays(totalDays - 1L))
            .status(PlanStatus.DRAFT)
            .deleted(false)
            .build();
    }

    /** 끝나는 날을 옮겨 일수를 {@code totalDays} 로 만든다. */
    private static PlanUpdateCommand shrinkTo(int totalDays) {
        return PlanUpdateCommand.builder().endDate(START.plusDays(totalDays - 1L)).build();
    }

    private static PlanItem item(int day) {
        return PlanItem.builder()
            .id(day)
            .planId(PLAN_ID)
            .day(day)
            .sequence(1)
            .itemType(PlanItemType.PLACE)
            .targetId(1L)
            .title("항목 " + day)
            .build();
    }

    private PlanCommandProcessor processor(StubPlanItemRepositoryPort items) {
        return processor(new StubPlanRepositoryPort(), items);
    }

    private PlanCommandProcessor processor(StubPlanRepositoryPort plans, StubPlanItemRepositoryPort items) {
        return new PlanCommandProcessor(
            plans, items, new StubPlanPetRepositoryPort(), new StubPlanPetConditionRepositoryPort(),
            new StubPlaceVerifyQueryPort(), new StubPlanWalkCourseQueryPort(),
            new StubPetConditionQueryPort(), new SnowflakeIdGenerator(1, 1));
    }

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

        /** 동행견 교체는 plan 행을 먼저 잠근다 — 대사 배치와 잠금 순서를 맞추기 위해서다. */
        @Override
        public Optional<Plan> findActiveByIdForUpdate(long planId) {
            return Optional.empty();
        }

        @Override
        public int promoteRepresentative(long planId, long petId, long expectedPetId) {
            throw new UnsupportedOperationException();
        }
    }

    /** 항목 조회 횟수를 센다 — 기간을 건드리지 않은 수정이 헛된 쿼리를 하지 않는지 본다. */
    private static class StubPlanItemRepositoryPort implements PlanItemRepositoryPort {

        private final List<PlanItem> items;
        private int lookups;

        private StubPlanItemRepositoryPort(PlanItem... items) {
            this.items = List.of(items);
        }

        @Override
        public List<PlanItem> findByPlanId(long planId) {
            lookups += 1;
            return items;
        }

        @Override
        public List<PlanItem> saveAll(List<PlanItem> saving) {
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

    private static class StubPlanPetRepositoryPort implements PlanPetRepositoryPort {

        @Override
        public List<PlanPet> saveAll(List<PlanPet> pets) {
            return new ArrayList<>(pets);
        }

        @Override
        public List<PlanPet> findByPlanId(long planId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public List<PlanPet> findByPlanIdForUpdate(long planId) {
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

        @Override
        public int deleteByPlanIdAndPetId(long planId, long petId) {
            throw new UnsupportedOperationException();
        }
    }

    private static class StubPetConditionQueryPort implements PetConditionQueryPort {

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
