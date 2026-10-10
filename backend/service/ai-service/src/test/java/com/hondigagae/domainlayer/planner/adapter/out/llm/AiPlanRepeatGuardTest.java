package com.hondigagae.domainlayer.planner.adapter.out.llm;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.planner.application.model.PlaceCandidate;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft.AiPlanDraftDay;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft.AiPlanDraftItem;
import com.hondigagae.shared.travel.plan.PlanItemType;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 다른 날 반복된 장소 바꾸기 (#1254). 바꾸는 쪽과 <b>두는 쪽</b>을 함께 밟는다 — 바꾸기만 보면 "먼 곳이라도 아무거나"
 * 넣거나 숙소의 이어 묵기까지 바꾸는 구현도 통과한다.
 *
 * <p>좌표는 dev 재현(2026-10-08, 3일차가 2일차의 중문색달해수욕장 · 애견카페왈 사계점을 되풀이) 근처의 장소다.
 */
class AiPlanRepeatGuardTest {

    private static final PlaceCandidate JUNGMUN_BEACH = place(1L, "중문색달해수욕장", "관광지", false, 33.2436, 126.4125);
    private static final PlaceCandidate ANDEOK_VALLEY = place(2L, "안덕계곡", "관광지", false, 33.2540, 126.3550);
    private static final PlaceCandidate JEONGBANG_FALLS = place(3L, "정방폭포", "관광지", false, 33.2448, 126.5715);
    private static final PlaceCandidate SUWOLBONG = place(4L, "수월봉", "관광지", false, 33.2955, 126.1631);
    private static final PlaceCandidate SAGYE_CAFE = place(11L, "애견카페왈 사계점", "음식점", true, 33.2290, 126.3060);
    private static final PlaceCandidate JUNGMUN_CAFE = place(12L, "중문 카페", "음식점", true, 33.2500, 126.4200);
    private static final PlaceCandidate DIOVILL = place(21L, "제주디오빌펜션", "숙박", true, 33.2500, 126.4100);

    @Test
    @DisplayName("이슈 재현 — 3일차가 2일차를 되풀이하면 같은 종류의 가까운 미사용 후보로 바꾸고 메모는 서버 문구다")
    void replacesRepeatedDayWithNearbyUnused() {
        AiPlanDraft draft = draft(
            day(2, place(JUNGMUN_BEACH), meal(SAGYE_CAFE), lodging(DIOVILL)),
            day(3, place(JUNGMUN_BEACH), meal(SAGYE_CAFE)));

        AiPlanDraft guarded = guard(JUNGMUN_BEACH, ANDEOK_VALLEY, JEONGBANG_FALLS, SUWOLBONG, SAGYE_CAFE, JUNGMUN_CAFE, DIOVILL)
            .apply(draft);

        assertThat(guarded.days().get(0)).isSameAs(draft.days().get(0));
        List<AiPlanDraftItem> day3 = guarded.days().get(1).items();
        // 중문에서 안덕계곡 5km · 정방폭포 15km — 가까운 쪽. 식사 자리는 음식점으로만
        assertThat(day3).extracting(AiPlanDraftItem::placeId).containsExactly(2L, 12L);
        assertThat(day3).extracting(AiPlanDraftItem::itemType).containsExactly(PlanItemType.PLACE, PlanItemType.MEAL);
        assertThat(day3).extracting(AiPlanDraftItem::note)
            .containsExactly("반려견과 함께 들르는 실외 장소예요.", "반려견과 함께 들르는 음식점·카페예요.");
    }

    @Test
    @DisplayName("같은 숙소에 이어 묵는 것은 반복이 아니다")
    void keepsConsecutiveStays() {
        AiPlanDraft draft = draft(
            day(1, place(ANDEOK_VALLEY), lodging(DIOVILL)),
            day(2, place(JUNGMUN_BEACH), lodging(DIOVILL)));

        AiPlanDraft guarded = guard(JUNGMUN_BEACH, ANDEOK_VALLEY, DIOVILL).apply(draft);

        assertThat(guarded.days().get(1)).isSameAs(draft.days().get(1));
    }

    @Test
    @DisplayName("종류를 지킨다 — 식사 자리에 더 가까운 관광지가 있어도 음식점을 넣는다")
    void keepsKindOfSlot() {
        AiPlanDraft draft = draft(day(1, meal(JUNGMUN_CAFE)), day(2, meal(JUNGMUN_CAFE)));

        // 중문 카페에서 중문색달해수욕장이 1km 로 가장 가깝지만 관광지다. 음식점은 사계점(11km)뿐이다
        AiPlanDraft guarded = guard(JUNGMUN_CAFE, JUNGMUN_BEACH, SAGYE_CAFE).apply(draft);

        assertThat(guarded.days().get(1).items()).extracting(AiPlanDraftItem::placeId).containsExactly(11L);
    }

    @Test
    @DisplayName("다른 날에 이미 쓴 후보로는 바꾸지 않는다")
    void neverSwapsIntoUsedPlace() {
        AiPlanDraft draft = draft(
            day(1, place(ANDEOK_VALLEY)),
            day(2, place(JUNGMUN_BEACH)),
            day(3, place(JUNGMUN_BEACH)));

        AiPlanDraft guarded = guard(JUNGMUN_BEACH, ANDEOK_VALLEY, JEONGBANG_FALLS).apply(draft);

        // 안덕계곡이 더 가깝지만 1일차에 있다
        assertThat(guarded.days().get(2).items()).extracting(AiPlanDraftItem::placeId).containsExactly(3L);
    }

    @Test
    @DisplayName("20km 안에 쓸 후보가 없으면 그대로 둔다 — 먼 곳으로 바꾸면 반복보다 나쁜 동선이 된다")
    void keepsRepeatWithoutNearbyCandidate() {
        AiPlanDraft draft = draft(
            day(1, place(JUNGMUN_BEACH), meal(SAGYE_CAFE)),
            day(2, place(JUNGMUN_BEACH), meal(SAGYE_CAFE)));

        // 수월봉은 중문에서 24km — 범위 밖. 다른 음식점은 없다
        AiPlanDraft guarded = guard(JUNGMUN_BEACH, SUWOLBONG, SAGYE_CAFE).apply(draft);

        assertThat(guarded.days().get(1)).isSameAs(draft.days().get(1));
    }

    @Test
    @DisplayName("같은 날 같은 곳을 연달아 넣어도 바꾼다 — dev 7일 4일차 숨비아일랜드 → 숨비아일랜드 (#1257)")
    void replacesRepeatWithinSameDay() {
        AiPlanDraft draft = draft(day(4, meal(SAGYE_CAFE), meal(SAGYE_CAFE), lodging(DIOVILL)));

        AiPlanDraft guarded = guard(SAGYE_CAFE, JUNGMUN_CAFE, DIOVILL).apply(draft);

        // 첫 번째는 그대로, 두 번째만 가까운 음식점으로. 숙소는 건드리지 않는다
        assertThat(guarded.days().get(0).items()).extracting(AiPlanDraftItem::placeId).containsExactly(11L, 12L, 21L);
    }

    private static AiPlanRepeatGuard guard(PlaceCandidate... candidates) {
        return new AiPlanRepeatGuard(List.of(candidates));
    }

    private static PlaceCandidate place(long id, String title, String contentType, boolean indoor, double lat, double lng) {
        return new PlaceCandidate(id, title, contentType, "제주", "동반 가능", null, null, indoor, null, lat, lng);
    }

    private static AiPlanDraft draft(AiPlanDraftDay... days) {
        return AiPlanDraft.builder().days(List.of(days)).reasons(List.of()).build();
    }

    private static AiPlanDraftDay day(int day, AiPlanDraftItem... items) {
        return AiPlanDraftDay.builder().day(day).items(List.of(items)).build();
    }

    private static AiPlanDraftItem place(PlaceCandidate place) {
        return item(PlanItemType.PLACE, place, "바다를 보며 걸어요.");
    }

    private static AiPlanDraftItem meal(PlaceCandidate place) {
        return item(PlanItemType.MEAL, place, "카페에서 쉬어요.");
    }

    private static AiPlanDraftItem lodging(PlaceCandidate place) {
        return item(PlanItemType.LODGING, place, AiPlanDraftFactGuard.LODGING_NOTE);
    }

    private static AiPlanDraftItem item(PlanItemType type, PlaceCandidate place, String note) {
        return AiPlanDraftItem.builder().itemType(type).placeId(place.placeId()).title(place.title()).note(note).build();
    }
}
