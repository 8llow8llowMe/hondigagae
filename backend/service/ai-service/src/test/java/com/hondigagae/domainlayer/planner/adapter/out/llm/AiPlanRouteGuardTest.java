package com.hondigagae.domainlayer.planner.adapter.out.llm;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.planner.application.model.AiPlanGenerationQuery;
import com.hondigagae.domainlayer.planner.application.model.PlaceCandidate;
import com.hondigagae.domainlayer.planner.application.model.PlanOutline;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft.AiPlanDraftDay;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft.AiPlanDraftItem;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft.AiPlanDraftReason;
import com.hondigagae.shared.travel.plan.PlanItemType;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 동선 대조 — 그날 밤 숙소 재배치 (#1171). 옮기는 쪽과 <b>두는 쪽</b>을 함께 밟는다 — 한쪽만 보면 "언제나 가장
 * 가까운 숙소로" 구현도 통과하는데, 그건 모델 선택과 이어 묵기를 무시한다.
 *
 * <p>좌표는 이슈 실측 일정(`몽과 제주 2박 3일`)과 dev 후보 풀(숙박 3곳)의 장소다.
 */
class AiPlanRouteGuardTest {

    // 숙박 후보 — dev 풀의 셋. 서귀포 시내 둘, 구좌 하나
    private static final PlaceCandidate SEOGWIPO_PENSION = stay(101L, "포시즌펜션", 33.2480, 126.5650);
    private static final PlaceCandidate DONNAEKO_RESORT = stay(102L, "돈내코힐 리조트", 33.2850, 126.5800);
    private static final PlaceCandidate GUJWA_HOUSE = stay(103L, "제주올레하우스", 33.5260, 126.8630);

    // 일정 장소 — 서 · 남쪽
    private static final PlaceCandidate GWAKJI = visit(1L, "곽지해수욕장", 33.4505, 126.3053);
    private static final PlaceCandidate SUWOLBONG = visit(2L, "수월봉", 33.2955, 126.1631);
    private static final PlaceCandidate ANDEOK = visit(3L, "안덕계곡", 33.2540, 126.3550);
    private static final PlaceCandidate JUNGMUN = visit(4L, "중문색달해수욕장", 33.2436, 126.4125);
    private static final PlaceCandidate JEONGBANG = visit(5L, "정방폭포", 33.2448, 126.5715);

    private static final List<PlaceCandidate> CANDIDATES = List.of(
        GWAKJI, SUWOLBONG, ANDEOK, JUNGMUN, JEONGBANG, SEOGWIPO_PENSION, DONNAEKO_RESORT, GUJWA_HOUSE);

    @Test
    @DisplayName("이슈 재현 — 서 · 남쪽 일정의 구좌 숙소는 서귀포 숙소로 옮기고, 이튿날도 거기서 이어 묵는다")
    void relocatesFarStayAndKeepsItNextNight() {
        AiPlanDraft draft = draft(
            day(1, place(GWAKJI), place(SUWOLBONG), lodging(GUJWA_HOUSE)),
            day(2, place(ANDEOK), place(JUNGMUN), lodging(GUJWA_HOUSE)),
            day(3, place(JEONGBANG)));

        AiPlanDraft routed = guard(Set.of()).apply(draft);

        assertThat(stayId(routed, 1)).isEqualTo(SEOGWIPO_PENSION.placeId());
        assertThat(stayId(routed, 2)).isEqualTo(SEOGWIPO_PENSION.placeId());
        AiPlanDraftItem stay = lastItem(routed, 1);
        assertThat(stay.itemType()).isEqualTo(PlanItemType.LODGING);
        assertThat(stay.title()).isEqualTo("포시즌펜션");
        assertThat(stay.note()).isEqualTo(AiPlanDraftFactGuard.LODGING_NOTE);
        // 숙소만 옮긴다 — 장소의 순서와 수는 그대로다
        assertThat(placeIds(routed, 1)).containsExactly(GWAKJI.placeId(), SUWOLBONG.placeId(), SEOGWIPO_PENSION.placeId());
        assertThat(placeIds(routed, 3)).containsExactly(JEONGBANG.placeId());
    }

    @Test
    @DisplayName("모델 숙소가 가장 가까운 숙소와 10km 안쪽 차이면 모델 선택을 둔다")
    void keepsStayWithinSwitchGain() {
        // 중문 → 돈내코 → 정방 은 포시즌보다 6km 남짓 멀 뿐이다
        AiPlanDraft draft = draft(
            day(1, place(JUNGMUN), lodging(DONNAEKO_RESORT)),
            day(2, place(JEONGBANG)));

        AiPlanDraft routed = guard(Set.of()).apply(draft);

        assertThat(stayId(routed, 1)).isEqualTo(DONNAEKO_RESORT.placeId());
        assertThat(routed.days().get(0)).isSameAs(draft.days().get(0));
    }

    @Test
    @DisplayName("옮길 때 전날 숙소가 충분히 가까우면 가장 가까운 숙소 대신 전날 숙소에서 이어 묵는다")
    void prefersPreviousStayWhenCloseEnough() {
        AiPlanDraft draft = draft(
            day(1, place(JEONGBANG), lodging(DONNAEKO_RESORT)),
            day(2, place(JUNGMUN), place(ANDEOK), lodging(GUJWA_HOUSE)),
            day(3, place(SUWOLBONG)));

        AiPlanDraft routed = guard(Set.of()).apply(draft);

        // 2일차 밤의 가장 가까운 숙소는 포시즌이지만, 돈내코가 3km 남짓 차이라 짐을 옮기지 않는다
        assertThat(stayId(routed, 1)).isEqualTo(DONNAEKO_RESORT.placeId());
        assertThat(stayId(routed, 2)).isEqualTo(DONNAEKO_RESORT.placeId());
    }

    @Test
    @DisplayName("필수 포함 · 선호 숙소는 멀어도 옮기지 않는다 — 사용자가 고른 곳이다")
    void keepsProtectedStay() {
        AiPlanDraft draft = draft(
            day(1, place(GWAKJI), place(SUWOLBONG), lodging(GUJWA_HOUSE)),
            day(2, place(ANDEOK)));

        AiPlanDraft routed = guard(Set.of(GUJWA_HOUSE.placeId())).apply(draft);

        assertThat(stayId(routed, 1)).isEqualTo(GUJWA_HOUSE.placeId());
    }

    @Test
    @DisplayName("하루 재생성이면 기존 일정의 숙소를 지킨다")
    void regenerationKeepsStayOfExistingPlan() {
        AiPlanGenerationQuery query = AiPlanGenerationQuery.builder()
            .startDate("2026-10-13")
            .endDate("2026-10-15")
            .regenerateDay(1)
            .planOutline(PlanOutline.builder()
                .planId(7L)
                .days(List.of(PlanOutline.PlanOutlineDay.builder()
                    .day(2)
                    .items(List.of(new PlanOutline.PlanOutlineItem("제주올레하우스", "LODGING", GUJWA_HOUSE.placeId())))
                    .build()))
                .build())
            .placeCandidates(CANDIDATES)
            .build();
        AiPlanDraft draft = draft(day(1, place(GWAKJI), place(SUWOLBONG), lodging(GUJWA_HOUSE)));

        AiPlanDraft routed = AiPlanRouteGuard.of(query).apply(draft);

        assertThat(stayId(routed, 1)).isEqualTo(GUJWA_HOUSE.placeId());
    }

    @Test
    @DisplayName("기준점 좌표를 모르면 그대로 둔다 — 근거 없이 옮기지 않는다")
    void keepsStayWithoutAnchors() {
        PlaceCandidate unknown = new PlaceCandidate(9L, "좌표없는곳", "관광지", "제주", "동반 가능",
            null, null, false, null, null, null);
        List<PlaceCandidate> candidates = new ArrayList<>(CANDIDATES);
        candidates.add(unknown);
        AiPlanDraft draft = draft(
            day(1, place(unknown), lodging(GUJWA_HOUSE)),
            day(2));

        AiPlanDraft routed = new AiPlanRouteGuard(candidates, Set.of()).apply(draft);

        assertThat(stayId(routed, 1)).isEqualTo(GUJWA_HOUSE.placeId());
    }

    @Test
    @DisplayName("숙박이 없는 날(마지막 날 · 당일치기)은 손대지 않고, 근거는 그대로 통과한다")
    void leavesDaysWithoutStayAndReasons() {
        AiPlanDraftReason reason = AiPlanDraftReason.builder().code("PET_ALLOWED").name("반려견 동반 가능")
            .description("모든 장소가 반려견 동반 가능이에요.").build();
        AiPlanDraft draft = AiPlanDraft.builder()
            .days(List.of(day(1, place(GWAKJI), place(JEONGBANG))))
            .reasons(List.of(reason))
            .build();

        AiPlanDraft routed = guard(Set.of()).apply(draft);

        assertThat(routed.days().get(0)).isSameAs(draft.days().get(0));
        assertThat(routed.reasons()).containsExactly(reason);
    }

    @Test
    @DisplayName("숙박 후보가 모델이 고른 하나뿐이면 옮길 곳이 없다")
    void keepsOnlyStay() {
        AiPlanRouteGuard onlyGujwa = new AiPlanRouteGuard(List.of(GWAKJI, SUWOLBONG, ANDEOK, GUJWA_HOUSE), Set.of());
        AiPlanDraft draft = draft(
            day(1, place(GWAKJI), place(SUWOLBONG), lodging(GUJWA_HOUSE)),
            day(2, place(ANDEOK)));

        AiPlanDraft routed = onlyGujwa.apply(draft);

        assertThat(stayId(routed, 1)).isEqualTo(GUJWA_HOUSE.placeId());
    }

    private static AiPlanRouteGuard guard(Set<Long> protectedPlaceIds) {
        return new AiPlanRouteGuard(CANDIDATES, protectedPlaceIds);
    }

    private static PlaceCandidate stay(long id, String title, double lat, double lng) {
        return new PlaceCandidate(id, title, "숙박", "제주", "동반 가능", null, null, true, null, lat, lng);
    }

    private static PlaceCandidate visit(long id, String title, double lat, double lng) {
        return new PlaceCandidate(id, title, "관광지", "제주", "동반 가능", null, null, false, null, lat, lng);
    }

    private static AiPlanDraft draft(AiPlanDraftDay... days) {
        return AiPlanDraft.builder().days(List.of(days)).reasons(List.of()).build();
    }

    private static AiPlanDraftDay day(int day, AiPlanDraftItem... items) {
        return AiPlanDraftDay.builder().day(day).items(List.of(items)).build();
    }

    private static AiPlanDraftItem place(PlaceCandidate place) {
        return AiPlanDraftItem.builder().itemType(PlanItemType.PLACE).placeId(place.placeId()).title(place.title())
            .note("둘러봐요.").build();
    }

    private static AiPlanDraftItem lodging(PlaceCandidate place) {
        return AiPlanDraftItem.builder().itemType(PlanItemType.LODGING).placeId(place.placeId()).title(place.title())
            .note(AiPlanDraftFactGuard.LODGING_NOTE).build();
    }

    private static AiPlanDraftItem lastItem(AiPlanDraft draft, int day) {
        List<AiPlanDraftItem> items = draft.days().get(day - 1).items();
        return items.get(items.size() - 1);
    }

    private static Long stayId(AiPlanDraft draft, int day) {
        AiPlanDraftItem last = lastItem(draft, day);
        assertThat(last.itemType()).isEqualTo(PlanItemType.LODGING);
        return last.placeId();
    }

    private static List<Long> placeIds(AiPlanDraft draft, int day) {
        return draft.days().get(day - 1).items().stream().map(AiPlanDraftItem::placeId).toList();
    }
}
