package com.hondigagae.domainlayer.plan.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.plan.application.exception.PlanErrorCode;
import com.hondigagae.domainlayer.plan.application.exception.PlanException;
import com.hondigagae.domainlayer.plan.application.info.PlanInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanItemInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanSummaryInfo;
import com.hondigagae.domainlayer.plan.application.port.out.PlanItemRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanPetRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanPlaceLookupPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.query.PlanPlaceSummaryQueryResult;
import com.hondigagae.shared.travel.plan.PlanItemType;
import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import com.hondigagae.domainlayer.plan.domain.model.PlanItem;
import com.hondigagae.domainlayer.plan.domain.model.PlanPet;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.SliceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Slice;

/**
 * 일정 상세의 장소 요약 보강 검증 — 이슈 #86.
 *
 * <p>여기서 고정하는 것은 셋이다.
 * <ul>
 *   <li><b>몇 번 부르는가</b> — 항목마다 부르면 이 이슈가 프론트에서 없애려는 문제를 백엔드로 옮기는 것이다
 *   <li><b>무엇을 묻는가</b> — {@code WALK} 의 {@code targetId} 는 {@code walk_course.id} 라 물으면 안 된다
 *   <li><b>없을 때 어떻게 되는가</b> — 요약이 없어도 항목은 남는다
 * </ul>
 */
class PlanQueryProcessorTest {

    private static final long PLAN_ID = 900L;
    private static final long MUSEUM_ID = 100L;
    private static final long CAFE_ID = 200L;
    private static final long DELISTED_ID = 300L;
    private static final long WALK_COURSE_ID = 777L;

    private StubPlanItemRepositoryPort planItemRepositoryPort;
    private StubPlanPetRepositoryPort planPetRepositoryPort;
    private StubPlanPlaceLookupPort planPlaceLookupPort;
    private StubPlanRepositoryPort planRepositoryPort;
    private PlanQueryProcessor processor;

    @BeforeEach
    void setUp() {
        planItemRepositoryPort = new StubPlanItemRepositoryPort();
        planPetRepositoryPort = new StubPlanPetRepositoryPort();
        planPlaceLookupPort = new StubPlanPlaceLookupPort();
        planRepositoryPort = new StubPlanRepositoryPort();
        processor = new PlanQueryProcessor(
            planRepositoryPort, planItemRepositoryPort, planPetRepositoryPort, planPlaceLookupPort);
    }

    private static Plan plan() {
        return Plan.builder()
            .id(PLAN_ID)
            .memberId(1L)
            .petId(2L)
            .areaCode("39")
            .title("몽실이와 제주 2박 3일")
            .startDate(LocalDate.of(2026, 9, 12))
            .endDate(LocalDate.of(2026, 9, 14))
            .status(PlanStatus.DRAFT)
            .build();
    }

    private static PlanItem item(int sequence, PlanItemType itemType, Long targetId, String title) {
        return PlanItem.builder()
            .id(1000L + sequence)
            .planId(PLAN_ID)
            .day(1)
            .sequence(sequence)
            .itemType(itemType)
            .targetId(targetId)
            .title(title)
            .build();
    }

    private PlanItemInfo itemAt(PlanInfo info, int index) {
        return info.items().get(index);
    }

    @Test
    @DisplayName("장소 항목에 주소·실내 여부·이미지·좌표가 붙는다")
    void detailCarriesPlaceSummary() {
        planItemRepositoryPort.items = List.of(item(0, PlanItemType.PLACE, MUSEUM_ID, "김창열미술관"));

        PlanInfo info = processor.getPlanDetailInfo(plan());

        assertThat(itemAt(info, 0).place()).isNotNull();
        assertThat(itemAt(info, 0).place().addr1()).isEqualTo("제주특별자치도 제주시 한림읍 용금로 906-107");
        assertThat(itemAt(info, 0).place().indoor()).isTrue();
        assertThat(itemAt(info, 0).place().firstImage()).isEqualTo("https://example.test/museum.jpg");
        assertThat(itemAt(info, 0).place().lat()).isEqualTo(33.3608276172);
        assertThat(itemAt(info, 0).place().lng()).isEqualTo(126.4106264);
    }

    @Test
    @DisplayName("항목이 여러 개여도 tour-service 를 한 번만 부른다")
    void looksUpOnce() {
        planItemRepositoryPort.items = List.of(
            item(0, PlanItemType.PLACE, MUSEUM_ID, "김창열미술관"),
            item(1, PlanItemType.MEAL, CAFE_ID, "오설록"),
            item(2, PlanItemType.LODGING, MUSEUM_ID, "펜션"));

        processor.getPlanDetailInfo(plan());

        assertThat(planPlaceLookupPort.calls).isEqualTo(1);
    }

    @Test
    @DisplayName("같은 장소를 여러 번 담아도 아이디는 한 번만 묻는다 — 며칠 연속 같은 숙소가 실제로 있다")
    void deduplicatesPlaceIds() {
        planItemRepositoryPort.items = List.of(
            item(0, PlanItemType.LODGING, MUSEUM_ID, "펜션 1일차"),
            item(1, PlanItemType.LODGING, MUSEUM_ID, "펜션 2일차"));

        processor.getPlanDetailInfo(plan());

        assertThat(planPlaceLookupPort.requestedIds).containsExactly(MUSEUM_ID);
    }

    @Test
    @DisplayName("WALK 의 targetId 는 묻지 않는다 — walk_course.id 라 남의 아이디다")
    void skipsWalkTargetId() {
        planItemRepositoryPort.items = List.of(
            item(0, PlanItemType.PLACE, MUSEUM_ID, "김창열미술관"),
            item(1, PlanItemType.WALK, WALK_COURSE_ID, "해안 산책로"),
            item(2, PlanItemType.MOVE, null, "숙소로 이동"));

        PlanInfo info = processor.getPlanDetailInfo(plan());

        assertThat(planPlaceLookupPort.requestedIds).containsExactly(MUSEUM_ID);
        // 요약은 없지만 행은 남는다
        assertThat(itemAt(info, 1).place()).isNull();
        assertThat(itemAt(info, 2).place()).isNull();
        assertThat(info.items()).hasSize(3);
    }

    @Test
    @DisplayName("원천에서 사라진 장소는 요약만 null 이고 항목은 남는다 — 사용자가 담아 둔 자료다")
    void keepsItemWhenPlaceIsDelisted() {
        planItemRepositoryPort.items = List.of(
            item(0, PlanItemType.PLACE, DELISTED_ID, "사라진 카페"),
            item(1, PlanItemType.PLACE, MUSEUM_ID, "김창열미술관"));

        PlanInfo info = processor.getPlanDetailInfo(plan());

        assertThat(info.items()).hasSize(2);
        assertThat(itemAt(info, 0).title()).isEqualTo("사라진 카페");
        assertThat(itemAt(info, 0).place()).isNull();
        assertThat(itemAt(info, 1).place()).isNotNull();
    }

    @Test
    @DisplayName("장소를 가리키는 항목이 없으면 tour-service 를 아예 부르지 않는다")
    void skipsLookupWhenNoPlaceTarget() {
        planItemRepositoryPort.items = List.of(item(0, PlanItemType.MOVE, null, "숙소로 이동"));

        processor.getPlanDetailInfo(plan());

        assertThat(planPlaceLookupPort.calls).isZero();
    }

    @Test
    @DisplayName("항목이 없으면 부르지 않는다")
    void skipsLookupWhenNoItems() {
        planItemRepositoryPort.items = List.of();

        PlanInfo info = processor.getPlanDetailInfo(plan());

        assertThat(info.items()).isEmpty();
        assertThat(planPlaceLookupPort.calls).isZero();
    }

    @Test
    @DisplayName("좌표가 없는 장소도 요약이 온다 — 주소·실내 여부는 쓸 수 있다")
    void carriesSummaryWithoutCoordinate() {
        planItemRepositoryPort.items = List.of(item(0, PlanItemType.PLACE, CAFE_ID, "오설록"));

        PlanInfo info = processor.getPlanDetailInfo(plan());

        assertThat(itemAt(info, 0).place()).isNotNull();
        assertThat(itemAt(info, 0).place().addr1()).isEqualTo("제주특별자치도 서귀포시 안덕면");
        assertThat(itemAt(info, 0).place().lat()).isNull();
        assertThat(itemAt(info, 0).place().lng()).isNull();
    }

    @Test
    @DisplayName("indoor 의 null 이 그대로 온다 — false(실외)로 바꾸지 않는다")
    void keepsIndoorNull() {
        planItemRepositoryPort.items = List.of(item(0, PlanItemType.PLACE, CAFE_ID, "오설록"));

        PlanInfo info = processor.getPlanDetailInfo(plan());

        assertThat(itemAt(info, 0).place().indoor()).isNull();
    }

    @Test
    @DisplayName("tour-service 가 죽어도 일정 상세는 응답한다 — 요약만 비고 항목은 남는다")
    void degradesWhenTourServiceIsDown() {
        planItemRepositoryPort.items = List.of(
            item(0, PlanItemType.PLACE, MUSEUM_ID, "김창열미술관"),
            item(1, PlanItemType.MEAL, CAFE_ID, "오설록"));
        planPlaceLookupPort.unavailable = true;

        PlanInfo info = processor.getPlanDetailInfo(plan());

        // 일정은 우리 DB 의 자료다 — 장식을 못 받았다고 자기 일정을 못 보면 안 된다
        assertThat(info.items()).hasSize(2);
        assertThat(itemAt(info, 0).title()).isEqualTo("김창열미술관");
        assertThat(itemAt(info, 0).place()).isNull();
        assertThat(itemAt(info, 1).place()).isNull();
    }

    @Test
    @DisplayName("내부 outline 경로(getPlanInfo)는 tour-service 를 부르지 않는다")
    void plainInfoDoesNotLookUp() {
        planItemRepositoryPort.items = List.of(item(0, PlanItemType.PLACE, MUSEUM_ID, "김창열미술관"));

        PlanInfo info = processor.getPlanInfo(plan());

        assertThat(planPlaceLookupPort.calls).isZero();
        assertThat(itemAt(info, 0).place()).isNull();
    }

    // ── 동행 반려견 (다견 담기) ──────────────────────────────────────────────

    @Test
    @DisplayName("조인 테이블에 행이 없는 옛 일정은 대표 반려견 한 마리가 곧 목록이다 — 옮기는 SQL 없이 배포한다")
    void legacyPlanFallsBackToRepresentativePet() {
        planPetRepositoryPort.pets = List.of();

        PlanInfo info = processor.getPlanInfo(plan());

        assertThat(info.petId()).isEqualTo(2L);
        assertThat(info.petIds()).containsExactly(2L);
    }

    @Test
    @DisplayName("조인 테이블이 있으면 저장 순서대로 전부 내리고, 첫 번째가 대표 반려견과 같다")
    void detailCarriesAllPets() {
        planPetRepositoryPort.pets = List.of(planPet(1L, PLAN_ID, 2L), planPet(2L, PLAN_ID, 5L));

        PlanInfo info = processor.getPlanInfo(plan());

        assertThat(info.petIds()).containsExactly(2L, 5L);
        assertThat(info.petIds().get(0)).isEqualTo(info.petId());
    }

    @Test
    @DisplayName("목록은 페이지의 반려견을 한 번에 묻고, 옛 일정과 새 일정이 섞여도 각자 맞게 읽힌다")
    void listLoadsPetsInOneQuery() {
        Plan legacy = plan().toBuilder().id(901L).petId(7L).build();
        Plan multi = plan().toBuilder().id(902L).petId(2L).build();
        planRepositoryPort.plans = List.of(multi, legacy);
        planPetRepositoryPort.pets = List.of(planPet(1L, 902L, 2L), planPet(2L, 902L, 5L));

        List<PlanSummaryInfo> summaries = processor.getMyPlans(1L, null, null, 10).getContent();

        assertThat(planPetRepositoryPort.bulkCalls).isEqualTo(1);
        assertThat(summaries.get(0).petIds()).containsExactly(2L, 5L);
        assertThat(summaries.get(1).petIds()).containsExactly(7L);
    }

    private static PlanPet planPet(long id, long planId, long petId) {
        return PlanPet.builder().id(id).planId(planId).petId(petId).build();
    }

    // ── 스텁 ───────────────────────────────────────────────────────────────

    private static class StubPlanPetRepositoryPort implements PlanPetRepositoryPort {

        private List<PlanPet> pets = List.of();
        private int bulkCalls;

        @Override
        public List<PlanPet> saveAll(List<PlanPet> pets) {
            throw new UnsupportedOperationException();
        }

        @Override
        public List<PlanPet> findByPlanId(long planId) {
            return pets.stream().filter(pet -> pet.planId() == planId).toList();
        }

        @Override
        public List<PlanPet> findByPlanIds(Collection<Long> planIds) {
            bulkCalls += 1;
            return pets.stream().filter(pet -> planIds.contains(pet.planId())).toList();
        }

        @Override
        public void deleteByPlanId(long planId) {
            throw new UnsupportedOperationException();
        }
    }

    private static class StubPlanItemRepositoryPort implements PlanItemRepositoryPort {

        private List<PlanItem> items = List.of();

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

    /**
     * {@code DELISTED_ID} 는 응답에서 빠진다 — 노출 불가 장소를 tour-service 가 빼고 주는 것과 같다.
     * {@code CAFE_ID} 는 좌표가 없고 {@code indoor} 도 null 이다 — 원천에 정보가 없는 장소다.
     */
    private static class StubPlanPlaceLookupPort implements PlanPlaceLookupPort {

        private int calls;
        private boolean unavailable;
        private final List<Long> requestedIds = new ArrayList<>();

        @Override
        public List<PlanPlaceSummaryQueryResult> findSummaries(List<Long> placeIds) {
            calls += 1;
            requestedIds.addAll(placeIds);

            if (unavailable) {
                throw new PlanException(PlanErrorCode.INTERNAL_SERVICE_UNAVAILABLE);
            }

            return placeIds.stream()
                .filter(placeId -> placeId != DELISTED_ID)
                .map(placeId -> placeId == MUSEUM_ID
                    ? PlanPlaceSummaryQueryResult.builder()
                        .placeId(MUSEUM_ID)
                        .title("김창열미술관")
                        .addr("제주특별자치도 제주시 한림읍 용금로 906-107")
                        .indoor(true)
                        .firstImage("https://example.test/museum.jpg")
                        .lat(33.3608276172)
                        .lng(126.4106264)
                        .build()
                    : PlanPlaceSummaryQueryResult.builder()
                        .placeId(placeId)
                        .title("오설록")
                        .addr("제주특별자치도 서귀포시 안덕면")
                        .build())
                .toList();
        }
    }

    private static class StubPlanRepositoryPort implements PlanRepositoryPort {

        private List<Plan> plans = List.of();

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
            return new SliceImpl<>(plans);
        }
    }
}
