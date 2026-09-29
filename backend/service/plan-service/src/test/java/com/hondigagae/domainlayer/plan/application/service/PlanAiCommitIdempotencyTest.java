package com.hondigagae.domainlayer.plan.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.hondigagae.domainlayer.plan.adapter.in.internal.dto.PlanAiCommitResponse;
import com.hondigagae.domainlayer.plan.adapter.in.internal.presenter.PlanInternalPresenter;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanDetailResponse;
import com.hondigagae.domainlayer.plan.adapter.in.web.presenter.PlanPresenter;
import com.hondigagae.domainlayer.plan.application.command.PlanCreateCommand;
import com.hondigagae.domainlayer.plan.application.command.PlanItemCommand;
import com.hondigagae.domainlayer.plan.application.port.out.PetConditionQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlaceVerifyQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanItemRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanPetConditionRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanPetRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanPlaceLookupPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanWalkCourseQueryPort;
import com.hondigagae.domainlayer.plan.application.service.processor.PlanCommandProcessor;
import com.hondigagae.domainlayer.plan.application.service.processor.PlanQueryProcessor;
import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import com.hondigagae.persistence.util.SnowflakeIdGenerator;
import com.hondigagae.shared.travel.plan.PlanItemType;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Slice;

/**
 * AI 초안 담기 멱등 (#970).
 *
 * <p>고정하는 것 — 같은 AI 작업을 몇 번 담아도 일정은 하나이고, 두 번째 담기는 원격 검증 없이 먼저 담긴 일정을
 * 돌려준다. 동시 요청이 유니크에 막히면 재조회로 같은 일정을 돌려주되, 멱등 키와 상관없는 충돌은 삼키지 않는다.
 *
 * <p>잡 조회가 쓰는 내부 조회({@link PlanInternalFacade#getAiCommit})도 여기서 함께 본다 — 담기와 <b>같은 판정</b>을
 * 써야 "담기는 기존 일정을 주는데 잡 화면은 담기 전" 같은 어긋남이 없다.
 *
 * <p>Processor 는 실물을 쓴다. Facade 만 떼어 Processor 를 흉내 내면 "재조회가 같은 판정을 쓰는가" 를 보지 못한다.
 * 저장소는 유니크 {@code (memberId, sourceAiJobId)} 를 흉내 내는 메모리 구현이고, 원격 포트만 Mockito 다.
 */
class PlanAiCommitIdempotencyTest {

    private static final long MEMBER_ID = 1L;
    private static final long OTHER_MEMBER_ID = 2L;
    private static final long PET_ID = 7L;
    private static final long PLACE_ID = 100L;
    private static final String JOB_ID = "3f2b8c1e-5d4a-4e6b-9c7d-1a2b3c4d5e6f";
    /**
     * 여행 전 상태 가드(#971 · #983)가 읽는 "오늘". 이 테스트는 담기만 보므로 가드에 걸리지 않게 픽스처 기간
     * (2026-09-12~14)이 지난 날로 고정한다 — 시스템 시각을 쓰면 결과가 실행 날짜에 따라 흔들린다.
     */
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final Clock CLOCK = Clock.fixed(LocalDate.of(2026, 9, 28).atStartOfDay(SEOUL).toInstant(), SEOUL);

    private FakePlanRepositoryPort plans;
    private PetConditionQueryPort petConditionQueryPort;
    private PlaceVerifyQueryPort placeVerifyQueryPort;
    private PlanWalkCourseQueryPort planWalkCourseQueryPort;
    private PlanWebFacade facade;
    private PlanInternalFacade internalFacade;

    @BeforeEach
    void setUp() {
        plans = new FakePlanRepositoryPort();
        petConditionQueryPort = mock(PetConditionQueryPort.class);
        placeVerifyQueryPort = mock(PlaceVerifyQueryPort.class);
        planWalkCourseQueryPort = mock(PlanWalkCourseQueryPort.class);
        when(petConditionQueryPort.findRepresentativePetId(anyLong())).thenReturn(Optional.of(PET_ID));
        when(petConditionQueryPort.findOwnedPetIds(anyLong(), anyList())).thenReturn(Set.of(PET_ID));
        when(placeVerifyQueryPort.findVisiblePlaceIds(anyCollection())).thenReturn(Set.of(PLACE_ID));

        PlanItemRepositoryPort items = mock(PlanItemRepositoryPort.class);
        PlanPetRepositoryPort pets = mock(PlanPetRepositoryPort.class);
        SnowflakeIdGenerator idGenerator = new SnowflakeIdGenerator(1, 1);
        PlanCommandProcessor commandProcessor = new PlanCommandProcessor(
            plans, items, pets, mock(PlanPetConditionRepositoryPort.class),
            placeVerifyQueryPort, planWalkCourseQueryPort, petConditionQueryPort, idGenerator, CLOCK);
        PlanQueryProcessor queryProcessor = new PlanQueryProcessor(
            plans, items, pets, mock(PlanPlaceLookupPort.class), planWalkCourseQueryPort);
        // 날씨·응급·브리핑은 이 유스케이스가 부르지 않는다.
        facade = new PlanWebFacade(queryProcessor, commandProcessor, null, null, null, new PlanPresenter(), null, null);
        internalFacade = new PlanInternalFacade(queryProcessor, new PlanInternalPresenter());
    }

    @Test
    @DisplayName("같은 작업을 다시 담으면 먼저 담긴 일정을 돌려주고, 원격 검증을 다시 부르지 않는다")
    void recommitReturnsExistingPlanWithoutRemoteCalls() {
        PlanDetailResponse first = facade.createPlan(MEMBER_ID, command(JOB_ID, "몽실이와 제주 2박 3일"));
        clearInvocations(petConditionQueryPort, placeVerifyQueryPort, planWalkCourseQueryPort);

        PlanDetailResponse second = facade.createPlan(MEMBER_ID, command(JOB_ID, "다른 제목"));

        assertThat(second.planId()).isEqualTo(first.planId());
        // 두 번째 요청의 제목은 반영하지 않는다 — "이미 담긴 것 열기" 다.
        assertThat(second.title()).isEqualTo("몽실이와 제주 2박 3일");
        assertThat(second.sourceAiJobId()).isEqualTo(JOB_ID);
        assertThat(plans.rows).hasSize(1);
        verifyNoInteractions(petConditionQueryPort, placeVerifyQueryPort, planWalkCourseQueryPort);
    }

    @Test
    @DisplayName("동시 담기가 유니크에 막히면 재조회로 먼저 담긴 일정을 돌려준다")
    void conflictOnSaveFallsBackToCommittedPlan() {
        Plan winner = plans.save(existingPlan(555L, JOB_ID));
        // 이 요청의 빠른 경로 조회 시점에는 상대가 아직 커밋하지 않았다.
        plans.lookupsToMiss = 1;

        PlanDetailResponse response = facade.createPlan(MEMBER_ID, command(JOB_ID, "늦게 누른 담기"));

        assertThat(response.planId()).isEqualTo(String.valueOf(winner.id()));
        assertThat(plans.rows).hasSize(1);
        // 경쟁에서 진 쪽도 빠른 경로를 지났으니 원격 검증은 한 번 탔다 — 재조회가 그것을 되돌리지는 않는다.
        verify(placeVerifyQueryPort).findVisiblePlaceIds(anyCollection());
    }

    @Test
    @DisplayName("멱등 키가 없는 요청의 저장 충돌은 그대로 던지고, 멱등 조회를 타지 않는다")
    void conflictWithoutJobIdPropagates() {
        DataIntegrityViolationException conflict = new DataIntegrityViolationException("uk_plan_item_plan_id_day_sequence");
        plans.failNextSaveWith = conflict;

        assertThatThrownBy(() -> facade.createPlan(MEMBER_ID, command(null, "직접 만든 일정")))
            .isSameAs(conflict);
        assertThat(plans.aiJobLookups).isZero();
    }

    @Test
    @DisplayName("멱등 키가 있어도 재조회가 비면(다른 제약 위반) 원래 예외를 그대로 던진다")
    void conflictUnrelatedToJobIdPropagates() {
        DataIntegrityViolationException conflict = new DataIntegrityViolationException("other constraint");
        plans.failNextSaveWith = conflict;

        assertThatThrownBy(() -> facade.createPlan(MEMBER_ID, command(JOB_ID, "몽실이와 제주 2박 3일")))
            .isSameAs(conflict);
        assertThat(plans.aiJobLookups).isEqualTo(2);
    }

    @Test
    @DisplayName("담은 일정을 삭제한 뒤 다시 담으면 새 일정이 생긴다 — 삭제가 멱등 키를 비운다")
    void recommitAfterDeleteCreatesNewPlan() {
        PlanDetailResponse first = facade.createPlan(MEMBER_ID, command(JOB_ID, "몽실이와 제주 2박 3일"));
        long firstPlanId = Long.parseLong(first.planId());
        facade.deletePlan(MEMBER_ID, firstPlanId);

        PlanDetailResponse again = facade.createPlan(MEMBER_ID, command(JOB_ID, "다시 담기"));

        assertThat(again.planId()).isNotEqualTo(first.planId());
        assertThat(again.title()).isEqualTo("다시 담기");
        Plan deleted = plans.rows.get(firstPlanId);
        assertThat(deleted.deleted()).isTrue();
        assertThat(deleted.sourceAiJobId()).isNull();
    }

    @Test
    @DisplayName("멱등 키가 없는 일반 생성은 멱등 조회를 타지 않고 매번 새 일정을 만든다")
    void plainCreateSkipsLookup() {
        PlanDetailResponse first = facade.createPlan(MEMBER_ID, command(null, "직접 만든 일정"));
        PlanDetailResponse second = facade.createPlan(MEMBER_ID, command(null, "직접 만든 일정"));

        assertThat(second.planId()).isNotEqualTo(first.planId());
        assertThat(first.sourceAiJobId()).isNull();
        assertThat(plans.aiJobLookups).isZero();
    }

    @Test
    @DisplayName("내부 조회 — 본인이 담은 작업이면 그 일정 아이디를 준다")
    void internalLookupReturnsOwnCommittedPlan() {
        PlanDetailResponse committed = facade.createPlan(MEMBER_ID, command(JOB_ID, "몽실이와 제주 2박 3일"));

        PlanAiCommitResponse response = internalFacade.getAiCommit(MEMBER_ID, JOB_ID);

        assertThat(response.planId()).isEqualTo(Long.parseLong(committed.planId()));
    }

    @Test
    @DisplayName("내부 조회 — 남의 memberId 로 물으면 null 이다 (404 가 아니다)")
    void internalLookupHidesOthersPlan() {
        facade.createPlan(MEMBER_ID, command(JOB_ID, "몽실이와 제주 2박 3일"));

        assertThat(internalFacade.getAiCommit(OTHER_MEMBER_ID, JOB_ID).planId()).isNull();
    }

    @Test
    @DisplayName("내부 조회 — 담은 일정을 삭제했거나 담은 적이 없으면 null 이다")
    void internalLookupReturnsNullAfterDeleteOrWithoutCommit() {
        assertThat(internalFacade.getAiCommit(MEMBER_ID, JOB_ID).planId()).isNull();

        PlanDetailResponse committed = facade.createPlan(MEMBER_ID, command(JOB_ID, "몽실이와 제주 2박 3일"));
        facade.deletePlan(MEMBER_ID, Long.parseLong(committed.planId()));

        assertThat(internalFacade.getAiCommit(MEMBER_ID, JOB_ID).planId()).isNull();
    }

    private static PlanCreateCommand command(String sourceAiJobId, String title) {
        return PlanCreateCommand.builder()
            .petIds(List.of())
            .areaCode("39")
            .title(title)
            .startDate(LocalDate.of(2026, 9, 12))
            .endDate(LocalDate.of(2026, 9, 14))
            .items(List.of(PlanItemCommand.builder()
                .day(1).sequence(1).itemType(PlanItemType.PLACE).targetId(PLACE_ID).title("협재 해수욕장")
                .build()))
            .sourceAiJobId(sourceAiJobId)
            .build();
    }

    private static Plan existingPlan(long planId, String sourceAiJobId) {
        return Plan.builder()
            .id(planId).memberId(MEMBER_ID).petId(PET_ID).areaCode("39").title("먼저 담긴 일정")
            .startDate(LocalDate.of(2026, 9, 12)).endDate(LocalDate.of(2026, 9, 14))
            .status(PlanStatus.DRAFT).deleted(false)
            .sourceAiJobId(sourceAiJobId)
            .build();
    }

    /** 유니크 {@code uk_plan_member_id_source_ai_job_id} 를 흉내 내는 메모리 저장소. */
    private static final class FakePlanRepositoryPort implements PlanRepositoryPort {

        private final Map<Long, Plan> rows = new LinkedHashMap<>();
        private int lookupsToMiss;
        private int aiJobLookups;
        private RuntimeException failNextSaveWith;

        @Override
        public Plan save(Plan plan) {
            if (failNextSaveWith != null) {
                RuntimeException failure = failNextSaveWith;
                failNextSaveWith = null;
                throw failure;
            }
            boolean duplicated = plan.sourceAiJobId() != null && rows.values().stream()
                .anyMatch(row -> row.id() != plan.id() && row.memberId() == plan.memberId()
                    && plan.sourceAiJobId().equals(row.sourceAiJobId()));
            if (duplicated) {
                throw new DataIntegrityViolationException("uk_plan_member_id_source_ai_job_id");
            }
            rows.put(plan.id(), plan);
            return plan;
        }

        @Override
        public Optional<Plan> findActiveBySourceAiJobId(long memberId, String sourceAiJobId) {
            aiJobLookups++;
            if (lookupsToMiss > 0) {
                lookupsToMiss--;
                return Optional.empty();
            }
            return rows.values().stream()
                .filter(row -> !row.deleted() && row.memberId() == memberId && sourceAiJobId.equals(row.sourceAiJobId()))
                .findFirst();
        }

        @Override
        public Optional<Plan> findActiveById(long planId) {
            return Optional.ofNullable(rows.get(planId)).filter(row -> !row.deleted());
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
}
