package com.hondigagae.domainlayer.plan.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.plan.application.command.PlanCreateCommand;
import com.hondigagae.domainlayer.plan.application.command.PlanItemCommand;
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
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
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
 * 다견 담기 — 생성·수정 시 반려견 결정 규칙 검증.
 *
 * <p>고정하는 것은 셋이다.
 * <ul>
 *   <li><b>대표 반려견은 첫 번째다</b> — {@code plan.petId} 와 조인 테이블 첫 행이 같아야 옛 경로와 새 경로가 같은 답을 낸다
 *   <li><b>지정이 없으면 대표 반려견이다</b> — ai-service 생성과 같은 규칙. 그것도 없으면 만들지 않는다
 *   <li><b>대표 반려견 조회는 지정이 없을 때만 부른다</b> — 매 담기마다 auth-service 를 왕복하지 않는다
 * </ul>
 *
 * <p>항목 타깃 검증(#715)도 여기 있다 — 같은 Processor 의 같은 진입점({@code verifyItemTargets})이고,
 * 원격 포트 스텁이 이미 이 파일에 묶여 있다.
 */
class PlanCommandProcessorTest {

    private static final long MEMBER_ID = 1L;
    private static final long REPRESENTATIVE_PET_ID = 77L;
    /** 픽스처 여행(2026-09-12~14)의 시작일. 여행 전 가드(#971) 테스트가 "오늘" 을 이 날 기준으로 옮긴다. */
    private static final LocalDate TRIP_START = LocalDate.of(2026, 9, 12);
    /** 서비스 기준 "오늘". 픽스처 여행(2026-09-12~14)이 이미 시작된 뒤로 고정해 여행 전 가드(#971)에 걸리지 않게 한다. */
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final Clock CLOCK = Clock.fixed(LocalDate.of(2026, 9, 28).atStartOfDay(SEOUL).toInstant(), SEOUL);

    /** 잠금과 DML 의 호출 순번. 대사 배치와 잠금 순서가 같은지 보는 데 쓴다. */
    private List<String> callOrder;
    private StubPlanRepositoryPort planRepositoryPort;
    private StubPlanPetRepositoryPort planPetRepositoryPort;
    private StubPetConditionQueryPort petConditionQueryPort;
    private StubPlanPetConditionRepositoryPort planPetConditionRepositoryPort;
    private StubPlaceVerifyQueryPort placeVerifyQueryPort;
    private StubPlanWalkCourseQueryPort planWalkCourseQueryPort;
    private StubPlanItemRepositoryPort planItemRepositoryPort;
    private PlanCommandProcessor processor;

    @BeforeEach
    void setUp() {
        callOrder = new ArrayList<>();
        planRepositoryPort = new StubPlanRepositoryPort(callOrder);
        planPetRepositoryPort = new StubPlanPetRepositoryPort(callOrder);
        petConditionQueryPort = new StubPetConditionQueryPort();
        planPetConditionRepositoryPort = new StubPlanPetConditionRepositoryPort();
        placeVerifyQueryPort = new StubPlaceVerifyQueryPort();
        planWalkCourseQueryPort = new StubPlanWalkCourseQueryPort();
        planItemRepositoryPort = new StubPlanItemRepositoryPort();
        processor = new PlanCommandProcessor(
            planRepositoryPort, planItemRepositoryPort, planPetRepositoryPort,
            planPetConditionRepositoryPort, placeVerifyQueryPort, planWalkCourseQueryPort,
            petConditionQueryPort, new SnowflakeIdGenerator(1, 1), CLOCK);
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

    /** Facade 와 같은 순서 — 반려견 확인(원격)은 트랜잭션 밖, 저장은 트랜잭션 안. */
    private Plan createPlan(List<Long> petIds) {
        PlanCreateCommand command = command(petIds);
        return processor.createPlan(MEMBER_ID, command, processor.resolvePetIds(MEMBER_ID, command.petIds()));
    }

    @Test
    @DisplayName("여러 마리를 지정하면 첫 번째가 대표 반려견이 되고, 전체는 조인 테이블에 순서대로 저장된다")
    void firstPetBecomesRepresentative() {
        Plan saved = createPlan(List.of(2L, 5L, 9L));

        assertThat(saved.petId()).isEqualTo(2L);
        assertThat(planPetRepositoryPort.saved).extracting(PlanPet::petId).containsExactly(2L, 5L, 9L);
        assertThat(planPetRepositoryPort.saved).allMatch(pet -> pet.planId() == saved.id());
        // 조인 테이블 첫 행 = 대표 반려견. 옛 일정(행 없음)과 새 일정이 같은 대표를 가리켜야 한다.
        assertThat(planPetRepositoryPort.saved.get(0).petId()).isEqualTo(saved.petId());
    }

    /*
     * 정책 고정 (#973). 직접 만들기는 지난 여행을 기록으로 받는다 — "오늘 이후" 제약은 예보가 있어야
     * 짤 수 있는 AI 생성(AIPLAN_017)에만 있다. 이 테스트가 깨지면 FE 만들기·수정·복사 폼의 날짜 정책과
     * frontend/docs/features/plan/공통명세.md S9 「날짜 정책」을 함께 바꿔야 한다.
     */
    @Test
    @DisplayName("지난 날짜로도 만든다 — 다녀온 여행을 기록하는 일정이다")
    void acceptsPastDatesAsRecord() {
        PlanCreateCommand past = PlanCreateCommand.builder()
            .petIds(List.of(2L))
            .areaCode("39")
            .title("몽실이와 다녀온 제주")
            .startDate(LocalDate.of(2020, 5, 1))
            .endDate(LocalDate.of(2020, 5, 3))
            .items(List.of())
            .build();

        Plan saved = processor.createPlan(MEMBER_ID, past, processor.resolvePetIds(MEMBER_ID, past.petIds()));

        assertThat(saved.startDate()).isEqualTo(LocalDate.of(2020, 5, 1));
        assertThat(saved.endDate()).isEqualTo(LocalDate.of(2020, 5, 3));
    }

    @Test
    @DisplayName("한 마리 지정도 조인 테이블에 남긴다 — 한 마리 일정과 여러 마리 일정을 같은 경로로 읽는다")
    void singlePetIsAlsoStoredInJoinTable() {
        Plan saved = createPlan(List.of(2L));

        assertThat(saved.petId()).isEqualTo(2L);
        assertThat(planPetRepositoryPort.saved).extracting(PlanPet::petId).containsExactly(2L);
    }

    @Test
    @DisplayName("반려견을 지정하지 않으면 대표 반려견으로 만든다 — ai-service 생성과 같은 규칙")
    void fallsBackToRepresentativePet() {
        petConditionQueryPort.representativePetId = REPRESENTATIVE_PET_ID;

        Plan saved = createPlan(List.of());

        assertThat(saved.petId()).isEqualTo(REPRESENTATIVE_PET_ID);
        assertThat(planPetRepositoryPort.saved).extracting(PlanPet::petId).containsExactly(REPRESENTATIVE_PET_ID);
    }

    @Test
    @DisplayName("지정도 없고 대표 반려견도 없으면 400 PET_REQUIRED — 반려견 없는 일정은 만들지 않는다")
    void rejectsWhenNoPetAtAll() {
        petConditionQueryPort.representativePetId = null;

        assertThatThrownBy(() -> createPlan(List.of()))
            .isInstanceOf(PlanException.class)
            .extracting(exception -> ((PlanException) exception).getErrorCode())
            .isEqualTo(PlanErrorCode.PET_REQUIRED);
        assertThat(planRepositoryPort.saved).isNull();
    }

    @Test
    @DisplayName("반려견을 지정했으면 대표 반려견을 묻지 않는다 — 담기마다 대표 조회를 왕복하지 않는다")
    void doesNotAskRepresentativeWhenSpecified() {
        createPlan(List.of(2L));

        assertThat(petConditionQueryPort.representativeCalls).isZero();
    }

    @Test
    @DisplayName("본인 소유가 아닌 petId 가 섞이면 400 NOT_FOUND_PET — 남의 반려견이 plan_pet 에 남지 않는다")
    void rejectsPetIdsNotOwnedByMember() {
        petConditionQueryPort.ownedPetIds = Set.of(2L);

        assertThatThrownBy(() -> createPlan(List.of(2L, 999L)))
            .isInstanceOf(PlanException.class)
            .extracting(exception -> ((PlanException) exception).getErrorCode())
            .isEqualTo(PlanErrorCode.NOT_FOUND_PET);
        assertThat(planRepositoryPort.saved).isNull();
        assertThat(planPetRepositoryPort.saved).isEmpty();
    }

    // ── 수정으로 동행견 바꾸기 (#621) ──────────────────────────────────────

    @Test
    @DisplayName("petIds 를 보내면 동행견을 목록 전체로 교체하고 첫 번째가 새 대표가 된다")
    void updateReplacesPets() {
        Plan updated = updatePets(plan(PlanStatus.DRAFT, 2L), List.of(9L, 2L));

        assertThat(updated.petId()).isEqualTo(9L);
        assertThat(planPetRepositoryPort.saved).extracting(PlanPet::petId).containsExactly(9L, 2L);
        // 지우고 넣는 순서가 아니면 같은 (planId, petId) 가 겹쳐 유니크 인덱스 위반으로 죽는다.
        assertThat(planPetRepositoryPort.deleteCalls).isEqualTo(1);
    }

    @Test
    @DisplayName("petIds 를 생략하면 동행견을 건드리지 않는다 — 제목만 고치는 요청이 아이를 지우지 않는다")
    void updateWithoutPetIdsKeepsPets() {
        Plan updated = updatePets(plan(PlanStatus.DRAFT, 2L), null);

        assertThat(updated.petId()).isEqualTo(2L);
        assertThat(planPetRepositoryPort.deleteCalls).isZero();
        assertThat(planPetRepositoryPort.saved).isEmpty();
    }

    @Test
    @DisplayName("빈 petIds 는 400 PET_REQUIRED — 대표 반려견으로 되살리지 않는다")
    void updateRejectsEmptyPetIds() {
        petConditionQueryPort.representativePetId = REPRESENTATIVE_PET_ID;

        assertThatThrownBy(() -> updatePets(plan(PlanStatus.DRAFT, 2L), List.of()))
            .isInstanceOf(PlanException.class)
            .extracting(exception -> ((PlanException) exception).getErrorCode())
            .isEqualTo(PlanErrorCode.PET_REQUIRED);
        // 생성 경로의 폴백이 새어 들어오면 사용자가 지우려던 아이가 말없이 돌아온다.
        assertThat(petConditionQueryPort.representativeCalls).isZero();
        assertThat(planPetRepositoryPort.deleteCalls).isZero();
    }

    @Test
    @DisplayName("동행견을 바꿀 때 plan 행을 plan_pet 보다 먼저 잠근다 — 대사 배치와 순서가 갈리면 데드락이다")
    void locksThePlanBeforeTouchingCompanionRows() {
        updatePets(plan(PlanStatus.DRAFT, 2L), List.of(9L));

        // 배치(PlanPetDetachProcessor)도 plan → plan_pet 순이다. 한쪽을 바꾸면 여기가 먼저 깨진다.
        assertThat(callOrder).containsExactly("lockPlan", "deletePlanPets");
    }

    @Test
    @DisplayName("동행견을 건드리지 않는 수정은 잠그지도 않는다 — 제목만 고치는 요청이 배치와 경합하지 않는다")
    void doesNotLockWhenCompanionsAreUntouched() {
        processor.updatePlan(plan(PlanStatus.DRAFT, 2L),
            PlanUpdateCommand.builder().title("제목만 바꾼다").build(), null, null);

        assertThat(callOrder).isEmpty();
    }

    @Test
    @DisplayName("본인 소유가 아닌 petId 가 섞이면 수정도 400 NOT_FOUND_PET 다")
    void updateRejectsPetIdsNotOwnedByMember() {
        petConditionQueryPort.ownedPetIds = Set.of(2L);

        assertThatThrownBy(() -> updatePets(plan(PlanStatus.DRAFT, 2L), List.of(2L, 999L)))
            .isInstanceOf(PlanException.class)
            .extracting(exception -> ((PlanException) exception).getErrorCode())
            .isEqualTo(PlanErrorCode.NOT_FOUND_PET);
        assertThat(planRepositoryPort.saved).isNull();
        assertThat(planPetRepositoryPort.deleteCalls).isZero();
    }

    @Test
    @DisplayName("완료된 일정의 동행견은 바꾸지 못한다 — 다녀온 기록의 판정 근거가 뒤늦게 흔들린다")
    void updateRejectsPetChangeOnCompletedPlan() {
        assertThatThrownBy(() -> updatePets(plan(PlanStatus.COMPLETED, 2L), List.of(9L)))
            .isInstanceOf(PlanException.class)
            .extracting(exception -> ((PlanException) exception).getErrorCode())
            .isEqualTo(PlanErrorCode.PLAN_COMPLETED_PET_LOCKED);
        assertThat(planRepositoryPort.saved).isNull();
        assertThat(planPetRepositoryPort.deleteCalls).isZero();
    }

    @Test
    @DisplayName("완료된 일정도 동행견을 빼면 다른 필드는 고칠 수 있다 — 잠긴 것은 동행견뿐이다")
    void updateAllowsOtherFieldsOnCompletedPlan() {
        Plan updated = processor.updatePlan(plan(PlanStatus.COMPLETED, 2L),
            PlanUpdateCommand.builder().title("다녀온 제주").build(), null, null);

        assertThat(updated.title()).isEqualTo("다녀온 제주");
        assertThat(updated.petId()).isEqualTo(2L);
    }

    @Test
    @DisplayName("같은 요청으로 완료하면서 동행견을 바꾸는 것은 막지 않는다 — 아직 기록이 확정되기 전이다")
    void allowsPetChangeWhileCompleting() {
        Plan plan = plan(PlanStatus.CONFIRMED, 2L);
        List<Long> petIds = List.of(9L);

        Plan updated = processor.updatePlan(plan,
            PlanUpdateCommand.builder().status(PlanStatus.COMPLETED).petIds(petIds).build(),
            processor.resolvePetIdsForUpdate(MEMBER_ID, petIds), null);

        assertThat(updated.status()).isEqualTo(PlanStatus.COMPLETED);
        assertThat(updated.petId()).isEqualTo(9L);
    }

    @Test
    @DisplayName("여행 전날 확정 일정을 완료하면 PLAN_026 으로 거부한다 — 떠나지 않은 여행을 다녀온 기록으로 남기지 않는다")
    void rejectsCompletingBeforeStart() {
        PlanCommandProcessor dayBefore = processorAt(TRIP_START.minusDays(1));

        assertThatThrownBy(() -> dayBefore.updatePlan(plan(PlanStatus.CONFIRMED, 2L),
            PlanUpdateCommand.builder().status(PlanStatus.COMPLETED).build(), null, Map.of()))
            .isInstanceOf(PlanException.class)
            .extracting(exception -> ((PlanException) exception).getErrorCode())
            .isEqualTo(PlanErrorCode.PLAN_NOT_STARTED_COMPLETE);
        assertThat(planRepositoryPort.saved).isNull();
    }

    @Test
    @DisplayName("시작일 당일에는 완료할 수 있다 — 당일치기 여행은 떠난 그날 끝난다")
    void allowsCompletingOnStartDay() {
        Plan updated = processorAt(TRIP_START).updatePlan(plan(PlanStatus.CONFIRMED, 2L),
            PlanUpdateCommand.builder().status(PlanStatus.COMPLETED).build(), null, null);

        assertThat(updated.status()).isEqualTo(PlanStatus.COMPLETED);
    }

    @Test
    @DisplayName("이미 지난 일정은 완료할 수 있다 — 기록용으로 만든 과거 일정도 시작일이 지났다")
    void allowsCompletingPastPlan() {
        Plan updated = processorAt(TRIP_START.plusMonths(1)).updatePlan(plan(PlanStatus.DRAFT, 2L),
            PlanUpdateCommand.builder().status(PlanStatus.COMPLETED).build(), null, null);

        assertThat(updated.status()).isEqualTo(PlanStatus.COMPLETED);
    }

    @Test
    @DisplayName("완료된 일정의 시작일을 미래로 옮기면 PLAN_026 으로 거부한다 — 날짜를 밀어 안 간 여행의 완료를 만드는 우회로다")
    void rejectsMovingCompletedPlanStartToFuture() {
        PlanCommandProcessor onStartDay = processorAt(TRIP_START);

        assertThatThrownBy(() -> onStartDay.updatePlan(plan(PlanStatus.COMPLETED, 2L),
            PlanUpdateCommand.builder().startDate(TRIP_START.plusDays(1)).build(), null, null))
            .isInstanceOf(PlanException.class)
            .extracting(exception -> ((PlanException) exception).getErrorCode())
            .isEqualTo(PlanErrorCode.PLAN_NOT_STARTED_COMPLETE);
        assertThat(planRepositoryPort.saved).isNull();
    }

    @Test
    @DisplayName("시작 전인 완료 일정도 시작일을 건드리지 않는 수정은 받는다 — 가드 이전 데이터의 제목 수정까지 깨지면 안 된다")
    void allowsTitleEditOnCompletedPlanNotYetStarted() {
        Plan updated = processorAt(TRIP_START.minusDays(3)).updatePlan(plan(PlanStatus.COMPLETED, 2L),
            PlanUpdateCommand.builder().title("다녀온 제주").build(), null, null);

        assertThat(updated.title()).isEqualTo("다녀온 제주");
        assertThat(updated.status()).isEqualTo(PlanStatus.COMPLETED);
    }

    @Test
    @DisplayName("이미 완료된 일정에 완료를 다시 보내는 것은 전이가 아니라 날짜와 무관하게 받는다")
    void allowsResendingCompletedRegardlessOfDate() {
        Plan updated = processorAt(TRIP_START.minusDays(3)).updatePlan(plan(PlanStatus.COMPLETED, 2L),
            PlanUpdateCommand.builder().status(PlanStatus.COMPLETED).build(), null, null);

        assertThat(updated.status()).isEqualTo(PlanStatus.COMPLETED);
    }

    // ── 다녀옴 표시 가드 (#983) ────────────────────────────────────────

    @Test
    @DisplayName("여행 전날 다녀옴으로 표시하면 PLAN_027 로 거부한다 — 떠나지 않은 여행에 다녀온 기록을 남기지 않는다")
    void rejectsMarkingVisitedBeforeStart() {
        PlanItem item = storedItem(false);

        assertThatThrownBy(() -> processorAt(TRIP_START.minusDays(1)).markItemVisited(plan(PlanStatus.CONFIRMED, 2L), item.id(), true))
            .isInstanceOf(PlanException.class)
            .extracting(exception -> ((PlanException) exception).getErrorCode())
            .isEqualTo(PlanErrorCode.PLAN_NOT_STARTED_VISIT);
        assertThat(planItemRepositoryPort.saved).isNull();
    }

    @Test
    @DisplayName("시작 전이라도 다녀옴 해제는 받는다 — 가드 이전 표시나 일정을 미래로 옮긴 뒤 남은 표시를 풀 수 있어야 한다")
    void allowsUnmarkingVisitedBeforeStart() {
        PlanItem item = storedItem(true);

        PlanItem updated = processorAt(TRIP_START.minusDays(3)).markItemVisited(plan(PlanStatus.CONFIRMED, 2L), item.id(), false);

        assertThat(updated.visited()).isFalse();
        assertThat(planItemRepositoryPort.saved).isEqualTo(updated);
    }

    @Test
    @DisplayName("시작일 당일에는 다녀옴으로 표시할 수 있다 — 여행은 그날 시작된다")
    void allowsMarkingVisitedOnStartDay() {
        PlanItem item = storedItem(false);

        PlanItem updated = processorAt(TRIP_START).markItemVisited(plan(PlanStatus.CONFIRMED, 2L), item.id(), true);

        assertThat(updated.visited()).isTrue();
        assertThat(planItemRepositoryPort.saved).isEqualTo(updated);
    }

    @Test
    @DisplayName("이미 지난 일정은 다녀옴으로 표시할 수 있다 — 일정 상태와 무관하게 날짜 하나로 가른다")
    void allowsMarkingVisitedOnPastPlan() {
        PlanItem item = storedItem(false);

        PlanItem updated = processorAt(TRIP_START.plusMonths(1)).markItemVisited(plan(PlanStatus.DRAFT, 2L), item.id(), true);

        assertThat(updated.visited()).isTrue();
    }

    @Test
    @DisplayName("남의 일정 항목은 시작 전이어도 PLAN_005 다 — 소유 확인이 날짜 가드보다 먼저다")
    void rejectsForeignItemWithNotFoundBeforeStartGuard() {
        PlanItem foreign = storedItem(false).toBuilder().id(902L).planId(999L).build();
        planItemRepositoryPort.stored.put(foreign.id(), foreign);

        assertThatThrownBy(() -> processorAt(TRIP_START.minusDays(1)).markItemVisited(plan(PlanStatus.CONFIRMED, 2L), foreign.id(), true))
            .isInstanceOf(PlanException.class)
            .extracting(exception -> ((PlanException) exception).getErrorCode())
            .isEqualTo(PlanErrorCode.NOT_FOUND_PLAN_ITEM);
        assertThat(planItemRepositoryPort.saved).isNull();
    }

    /** 픽스처 일정(id 500)의 1일차 항목을 스텁에 심는다. */
    private PlanItem storedItem(boolean visited) {
        PlanItem item = PlanItem.builder()
            .id(901L)
            .planId(500L)
            .day(1)
            .sequence(0)
            .itemType(PlanItemType.PLACE)
            .targetId(10L)
            .title("천지연폭포")
            .visited(visited)
            .build();
        planItemRepositoryPort.stored.put(item.id(), item);
        return item;
    }

    /** 같은 스텁을 쓰되 "오늘" 만 {@code today} 로 옮긴 Processor. */
    private PlanCommandProcessor processorAt(LocalDate today) {
        return new PlanCommandProcessor(
            planRepositoryPort, planItemRepositoryPort, planPetRepositoryPort,
            planPetConditionRepositoryPort, placeVerifyQueryPort, planWalkCourseQueryPort,
            petConditionQueryPort, new SnowflakeIdGenerator(1, 1),
            Clock.fixed(today.atStartOfDay(SEOUL).toInstant(), SEOUL));
    }

    private static Plan plan(PlanStatus status, long petId) {
        return Plan.builder()
            .id(500L)
            .memberId(MEMBER_ID)
            .petId(petId)
            .areaCode("39")
            .title("몽실이와 제주 2박 3일")
            .startDate(LocalDate.of(2026, 9, 12))
            .endDate(LocalDate.of(2026, 9, 14))
            .status(status)
            .deleted(false)
            .build();
    }

    /** Facade 와 같은 순서 — 반려견 확인(원격)은 트랜잭션 밖, 저장은 트랜잭션 안. */
    private Plan updatePets(Plan plan, List<Long> petIds) {
        PlanUpdateCommand command = PlanUpdateCommand.builder().petIds(petIds).build();
        return processor.updatePlan(plan, command,
            command.petIds() == null ? null : processor.resolvePetIdsForUpdate(MEMBER_ID, command.petIds()),
            null);
    }

    // ── 완료 시점 반려견 특성 스냅샷 (#629) ────────────────────────────────

    @Test
    @DisplayName("완료로 넘어가면 그 시점의 반려견 특성을 스냅샷으로 남긴다")
    void snapshotsPetConditionsOnCompletion() {
        Plan plan = plan(PlanStatus.CONFIRMED, 2L);

        processor.updatePlan(plan, PlanUpdateCommand.builder().status(PlanStatus.COMPLETED).build(),
            null, Map.of(2L, condition("포메라니안", true)));

        assertThat(planPetConditionRepositoryPort.stored).singleElement()
            .satisfies(snapshot -> {
                assertThat(snapshot.planId()).isEqualTo(plan.id());
                assertThat(snapshot.petId()).isEqualTo(2L);
                assertThat(snapshot.breed()).isEqualTo("포메라니안");
                assertThat(snapshot.heatSensitive()).isTrue();
            });
    }

    @Test
    @DisplayName("완료 전이가 아니면 스냅샷을 건드리지 않는다 — 제목만 고치는 요청이 기록을 다시 쓰지 않는다")
    void keepsSnapshotWhenNotCompleting() {
        processor.updatePlan(plan(PlanStatus.CONFIRMED, 2L),
            PlanUpdateCommand.builder().title("제목만 바꾼다").build(), null, null);

        assertThat(planPetConditionRepositoryPort.stored).isEmpty();
        assertThat(planPetConditionRepositoryPort.deleteCalls).isZero();
    }

    @Test
    @DisplayName("다시 완료하면 옛 스냅샷을 걷고 그 시점으로 다시 찍는다 — 되돌린 동안 동행견이 바뀔 수 있다")
    void recompletingReplacesSnapshot() {
        Plan plan = plan(PlanStatus.CONFIRMED, 2L);
        processor.updatePlan(plan, PlanUpdateCommand.builder().status(PlanStatus.COMPLETED).build(),
            null, Map.of(2L, condition("포메라니안", true)));

        processor.updatePlan(plan, PlanUpdateCommand.builder().status(PlanStatus.COMPLETED).build(),
            null, Map.of(9L, condition("비숑프리제", false)));

        assertThat(planPetConditionRepositoryPort.deleteCalls).isEqualTo(2);
        assertThat(planPetConditionRepositoryPort.stored).singleElement()
            .satisfies(snapshot -> assertThat(snapshot.petId()).isEqualTo(9L));
    }

    @Test
    @DisplayName("이미 완료된 일정에 다시 COMPLETED 를 보내는 것은 전이가 아니다 — 그때 다시 찍으면 기록이 거짓이 된다")
    void completesNowOnlyOnTransition() {
        PlanUpdateCommand toCompleted = PlanUpdateCommand.builder().status(PlanStatus.COMPLETED).build();

        assertThat(PlanCommandProcessor.completesNow(plan(PlanStatus.CONFIRMED, 2L), toCompleted)).isTrue();
        assertThat(PlanCommandProcessor.completesNow(plan(PlanStatus.DRAFT, 2L), toCompleted)).isTrue();
        assertThat(PlanCommandProcessor.completesNow(plan(PlanStatus.COMPLETED, 2L), toCompleted)).isFalse();
        // 상태를 건드리지 않는 요청도 전이가 아니다.
        assertThat(PlanCommandProcessor.completesNow(plan(PlanStatus.CONFIRMED, 2L),
            PlanUpdateCommand.builder().title("제목만").build())).isFalse();
    }

    private static PetConditionQueryResult condition(String breed, boolean heatSensitive) {
        return PetConditionQueryResult.builder().breed(breed).heatSensitive(heatSensitive).build();
    }

    // ── 항목 타깃 검증 (#715) ──────────────────────────────────────────────

    /**
     * 유형마다 {@code targetId} 의 아이디 공간이 다르다 — {@code WALK} 는 {@code walk_course.id},
     * 나머지는 {@code place.id} 다. 고정하는 것은 셋이다.
     *
     * <ul>
     *   <li><b>없는 코스는 거부한다</b> — 그냥 저장하면 제목만 남은 항목이 되고, 상세의 빈 요약은
     *       "코스 없음" 과 "tour-service 장애" 를 구분해 주지 못한다
     *   <li><b>원격 호출은 종류마다 한 번이다</b> — 항목마다 부르면 저장 한 번에 왕복이 항목 수만큼 생긴다
     *   <li><b>{@code targetId} 가 null 이면 묻지 않는다</b> — 장소 경로와 같은 처리다
     * </ul>
     */
    @Test
    @DisplayName("존재하지 않는 산책 코스를 가리키는 WALK 항목은 400 PLAN_025 로 거부한다")
    void rejectsWalkItemWithUnknownCourse() {
        planWalkCourseQueryPort.existingIds.add(20L);

        assertThatThrownBy(() -> processor.verifyItemTargets(List.of(item(1, PlanItemType.WALK, 999L))))
            .isInstanceOf(PlanException.class)
            .extracting(exception -> ((PlanException) exception).getErrorCode())
            .isEqualTo(PlanErrorCode.NOT_FOUND_PLAN_WALK_COURSE);
    }

    @Test
    @DisplayName("존재하는 코스를 가리키면 통과한다 — 아이디 목록에서 빠진 것만 거부한다")
    void acceptsWalkItemWithExistingCourse() {
        planWalkCourseQueryPort.existingIds.add(20L);

        processor.verifyItemTargets(List.of(item(1, PlanItemType.WALK, 20L)));

        assertThat(planWalkCourseQueryPort.requests).hasSize(1);
    }

    @Test
    @DisplayName("장소와 산책 코스가 섞여 있으면 원격 호출은 종류마다 한 번이다 — 항목 수만큼 왕복하지 않는다")
    void verifiesEachTargetKindWithOneRemoteCall() {
        planWalkCourseQueryPort.existingIds.addAll(Set.of(20L, 21L));

        processor.verifyItemTargets(List.of(
            item(1, PlanItemType.PLACE, 10L), item(2, PlanItemType.MEAL, 11L),
            item(3, PlanItemType.WALK, 20L), item(4, PlanItemType.WALK, 21L),
            item(5, PlanItemType.MOVE, null)));

        assertThat(placeVerifyQueryPort.requests).hasSize(1);
        assertThat(placeVerifyQueryPort.requests.get(0)).containsExactlyInAnyOrder(10L, 11L);
        assertThat(planWalkCourseQueryPort.requests).hasSize(1);
        assertThat(planWalkCourseQueryPort.requests.get(0)).containsExactlyInAnyOrder(20L, 21L);
    }

    @Test
    @DisplayName("WALK 항목이 없으면 코스 조회를 아예 부르지 않는다 — 장소만 담은 저장에 왕복을 늘리지 않는다")
    void doesNotAskCoursesWithoutWalkItems() {
        processor.verifyItemTargets(List.of(item(1, PlanItemType.PLACE, 10L)));

        assertThat(planWalkCourseQueryPort.requests).isEmpty();
    }

    @Test
    @DisplayName("targetId 가 null 인 WALK 항목은 장소 경로와 같이 묻지 않는다 — 대상 없는 줄은 담을 수 있다")
    void skipsNullTargetIdsLikePlacePath() {
        processor.verifyItemTargets(List.of(
            item(1, PlanItemType.WALK, null), item(2, PlanItemType.PLACE, null)));

        assertThat(planWalkCourseQueryPort.requests).isEmpty();
        assertThat(placeVerifyQueryPort.requests).isEmpty();
    }

    private static PlanItemCommand item(int sequence, PlanItemType itemType, Long targetId) {
        return PlanItemCommand.builder()
            .day(1)
            .sequence(sequence)
            .itemType(itemType)
            .targetId(targetId)
            .title("항목 " + sequence)
            .build();
    }

    // ── 스텁 ───────────────────────────────────────────────────────────────

    private static class StubPlanRepositoryPort implements PlanRepositoryPort {

        private final List<String> callOrder;
        private Plan saved;

        private StubPlanRepositoryPort(List<String> callOrder) {
            this.callOrder = callOrder;
        }

        @Override
        public Plan save(Plan plan) {
            saved = plan;
            return plan;
        }

        @Override
        public Optional<Plan> findActiveBySourceAiJobId(long memberId, String sourceAiJobId) {
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
        public List<Plan> findPlansWithPet(long memberId, long petId) {
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

        /** 동행견 교체가 plan 행을 먼저 잠그는지 본다 — 대사 배치와 잠금 순서가 갈리면 데드락이다. */
        @Override
        public Optional<Plan> findActiveByIdForUpdate(long planId) {
            callOrder.add("lockPlan");
            return Optional.ofNullable(saved).filter(plan -> plan.id() == planId);
        }

        @Override
        public int promoteRepresentative(long planId, long petId, long expectedPetId) {
            throw new UnsupportedOperationException();
        }
    }

    private static class StubPlanPetRepositoryPort implements PlanPetRepositoryPort {

        private final List<PlanPet> saved = new ArrayList<>();
        private final List<String> callOrder;
        private int deleteCalls;

        private StubPlanPetRepositoryPort(List<String> callOrder) {
            this.callOrder = callOrder;
        }

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
        public List<PlanPet> findByPlanIdForUpdate(long planId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public List<PlanPet> findByPlanIds(Collection<Long> planIds) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void deleteByPlanId(long planId) {
            callOrder.add("deletePlanPets");
            deleteCalls++;
            saved.clear();
        }

        @Override
        public int deleteByPlanIdAndPetId(long planId, long petId) {
            throw new UnsupportedOperationException();
        }
    }

    private static class StubPetConditionQueryPort implements PetConditionQueryPort {

        private Long representativePetId;
        private int representativeCalls;
        /** null 이면 요청 전부를 소유로 본다. */
        private Set<Long> ownedPetIds;

        @Override
        public Map<Long, PetConditionQueryResult> findConditions(long memberId, List<Long> petIds) {
            throw new UnsupportedOperationException();
        }

        @Override
        public Optional<Long> findRepresentativePetId(long memberId) {
            representativeCalls += 1;
            return Optional.ofNullable(representativePetId);
        }

        @Override
        public Set<Long> findOwnedPetIds(long memberId, List<Long> petIds) {
            return ownedPetIds != null ? ownedPetIds : new HashSet<>(petIds);
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

        /** 방문 체크(#983) 테스트가 심어 두는 항목. */
        private final Map<Long, PlanItem> stored = new HashMap<>();
        /** {@code save} 로 들어온 마지막 항목. 거부된 요청이 저장까지 가지 않았는지 보는 데 쓴다. */
        private PlanItem saved;

        @Override
        public Optional<PlanItem> findById(long planItemId) {
            return Optional.ofNullable(stored.get(planItemId));
        }

        @Override
        public PlanItem save(PlanItem item) {
            saved = item;
            return item;
        }

        @Override
        public void deleteByPlanIdAndDay(long planId, int day) {
            throw new UnsupportedOperationException();
        }
    }

    private static class StubPlaceVerifyQueryPort implements PlaceVerifyQueryPort {

        /** 호출마다 요청 목록을 남긴다 — 코스 검증과 같이 "종류마다 한 번" 을 고정한다. */
        private final List<List<Long>> requests = new ArrayList<>();

        @Override
        public Set<Long> findVisiblePlaceIds(Collection<Long> placeIds) {
            requests.add(List.copyOf(placeIds));
            return new HashSet<>(placeIds);
        }
    }
}
