package com.hondigagae.domainlayer.planner.adapter.out.llm;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.common.geo.GeoDistance;
import com.hondigagae.domainlayer.planner.application.model.AiPlanGenerationQuery;
import com.hondigagae.domainlayer.planner.application.model.PlaceCandidate;
import com.hondigagae.domainlayer.planner.application.model.PlanOutline;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft.AiPlanDraftDay;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft.AiPlanDraftItem;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft.AiPlanDraftReason;
import com.hondigagae.shared.travel.plan.PlanItemType;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 동선 대조 — 그날 밤 숙소 재배치 (#1171)와 권역 이탈 방문지 교체 (#1334). 옮기는 쪽과 <b>두는 쪽</b>을 함께 밟는다 — 한쪽만 보면 "언제나 가장
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

    // 권역 이탈 방문지 교체 (#1334) — prod 2일차: 애월 숙소 → 중문(남서부) → 선녀와나무꾼(북동부) 37.6km
    private static final PlaceCandidate URBAN_COUNTRY = stay(104L, "어반컨트리", 33.4560, 126.3400);
    private static final PlaceCandidate SEONNYEO = visit(6L, "선녀와나무꾼", 33.4830, 126.7100);
    private static final PlaceCandidate BONTAE = candidate(7L, "본태박물관", "관광지", true, 33.3030, 126.3940);
    private static final PlaceCandidate CAMELLIA = visit(8L, "카멜리아힐", 33.2900, 126.3700);
    private static final PlaceCandidate HYEOPJAE = visit(11L, "협재해수욕장", 33.3940, 126.2390);
    private static final PlaceCandidate YONGDUAM = visit(12L, "용두암", 33.5160, 126.5120);
    private static final PlaceCandidate MULYEONGARI = visit(13L, "물영아리오름", 33.3700, 126.6920);
    private static final PlaceCandidate ISEUNGAK = visit(14L, "이승악오름", 33.3500, 126.6200);
    private static final PlaceCandidate ANDEOK_DINER =
        candidate(15L, "안덕식당", AiPlanDraftFactGuard.RESTAURANT_CONTENT_TYPE, false, 33.2600, 126.3300);
    private static final PlaceCandidate SEONHEUL_CAFE =
        candidate(16L, "선흘카페", AiPlanDraftFactGuard.RESTAURANT_CONTENT_TYPE, false, 33.4820, 126.7120);

    @Test
    @DisplayName("이슈 재현 — 북동부로 튄 방문지를 남서부 미사용 후보로 바꾸고, 숙소는 바꾼 장소 기준으로 옮긴다")
    void replacesOffZoneVisitAndRelocatesStayFromIt() {
        AiPlanRouteGuard guard = new AiPlanRouteGuard(List.of(GWAKJI, ANDEOK, JUNGMUN, JEONGBANG, SEONNYEO, BONTAE,
            URBAN_COUNTRY, SEOGWIPO_PENSION, DONNAEKO_RESORT, GUJWA_HOUSE), Set.of());
        AiPlanDraft draft = draft(
            day(1, place(GWAKJI), lodging(URBAN_COUNTRY)),
            day(2, place(JUNGMUN), place(SEONNYEO), lodging(GUJWA_HOUSE)),
            day(3, place(JEONGBANG)));

        AiPlanDraft routed = guard.apply(draft);

        // 순서와 자리는 그대로 — 정방폭포(남부)는 15km 안이지만 북서부와 맞닿지 않아 고르지 않는다
        assertThat(placeIds(routed, 2)).containsExactly(JUNGMUN.placeId(), ANDEOK.placeId(), SEOGWIPO_PENSION.placeId());
        AiPlanDraftItem swapped = routed.days().get(1).items().get(1);
        assertThat(swapped.itemType()).isEqualTo(PlanItemType.PLACE);
        assertThat(swapped.title()).isEqualTo("안덕계곡");
        assertThat(swapped.note()).isEqualTo(AiPlanDraftFactGuard.fallbackNote(ANDEOK));
        assertThat(stayId(routed, 1)).isEqualTo(URBAN_COUNTRY.placeId());
        assertThat(maxLegMeters(routed, 2, URBAN_COUNTRY)).isLessThan(30_000d);
    }

    @Test
    @DisplayName("원본이 실내면 더 가까운 실외보다 실내 후보를 먼저 고른다")
    void prefersIndoorCandidateForIndoorOriginal() {
        PlaceCandidate indoorSeonnyeo = candidate(SEONNYEO.placeId(), SEONNYEO.title(), "관광지", true,
            SEONNYEO.lat(), SEONNYEO.lng());
        AiPlanRouteGuard guard = new AiPlanRouteGuard(List.of(GWAKJI, ANDEOK, JUNGMUN, indoorSeonnyeo, BONTAE, URBAN_COUNTRY),
            Set.of());
        AiPlanDraft draft = draft(
            day(1, place(GWAKJI), lodging(URBAN_COUNTRY)),
            day(2, place(JUNGMUN), place(indoorSeonnyeo)));

        AiPlanDraft routed = guard.apply(draft);

        // 안덕계곡(실외)이 5.4km 로 더 가깝지만, 실내 자리를 실외로 바꾸지 않는다 — 비 오는 날의 자리일 수 있다
        assertThat(placeIds(routed, 2)).containsExactly(JUNGMUN.placeId(), BONTAE.placeId());
    }

    @Test
    @DisplayName("맞닿은 권역으로의 긴 구간과, 맞닿지 않아도 25km 안쪽 구간은 손대지 않는다")
    void keepsAdjacentZoneAndShortLeg() {
        AiPlanRouteGuard guard = new AiPlanRouteGuard(List.of(HYEOPJAE, YONGDUAM, MULYEONGARI, ISEUNGAK, GWAKJI, ANDEOK,
            JEONGBANG), Set.of());
        AiPlanDraft draft = draft(
            // 북서부 → 북부 28.8km — 맞닿은 권역이다
            day(1, place(HYEOPJAE), place(YONGDUAM)),
            // 남부 → 북동부 7km 남짓 — 맞닿지 않지만 짧다
            day(2, place(ISEUNGAK), place(MULYEONGARI)));

        AiPlanDraft routed = guard.apply(draft);

        assertThat(routed.days().get(0)).isSameAs(draft.days().get(0));
        assertThat(routed.days().get(1)).isSameAs(draft.days().get(1));
    }

    @Test
    @DisplayName("20km 안에 같은 종류 · 맞는 권역의 미사용 후보가 없으면 그대로 둔다")
    void keepsOffZoneVisitWithoutNearbyCandidate() {
        // 수월봉은 중문에서 23km, 정방폭포는 남부, 안덕식당은 음식점이다
        AiPlanRouteGuard guard = new AiPlanRouteGuard(List.of(GWAKJI, JUNGMUN, SEONNYEO, SUWOLBONG, JEONGBANG, ANDEOK_DINER,
            URBAN_COUNTRY), Set.of());
        AiPlanDraft draft = draft(
            day(1, place(GWAKJI), lodging(URBAN_COUNTRY)),
            day(2, place(JUNGMUN), place(SEONNYEO)));

        AiPlanDraft routed = guard.apply(draft);

        assertThat(placeIds(routed, 2)).containsExactly(JUNGMUN.placeId(), SEONNYEO.placeId());
    }

    @Test
    @DisplayName("식사 자리는 더 가까운 장소가 있어도 음식점으로만 바꾼다")
    void replacesMealOnlyWithRestaurant() {
        AiPlanRouteGuard guard = new AiPlanRouteGuard(List.of(GWAKJI, JUNGMUN, ANDEOK, SEONHEUL_CAFE, ANDEOK_DINER,
            URBAN_COUNTRY), Set.of());
        AiPlanDraft draft = draft(
            day(1, place(GWAKJI), lodging(URBAN_COUNTRY)),
            day(2, place(JUNGMUN), meal(SEONHEUL_CAFE)));

        AiPlanDraft routed = guard.apply(draft);

        // 안덕계곡(5.4km)이 안덕식당(7.9km)보다 가깝지만 식사 자리다
        AiPlanDraftItem swapped = routed.days().get(1).items().get(1);
        assertThat(swapped.itemType()).isEqualTo(PlanItemType.MEAL);
        assertThat(swapped.placeId()).isEqualTo(ANDEOK_DINER.placeId());
        assertThat(swapped.note()).isEqualTo(AiPlanDraftFactGuard.fallbackNote(ANDEOK_DINER));
    }

    @Test
    @DisplayName("필수 포함 · 선호 장소는 권역을 벗어나도 바꾸지 않는다 — 사용자가 고른 곳이다")
    void keepsProtectedOffZoneVisit() {
        AiPlanRouteGuard guard = new AiPlanRouteGuard(List.of(GWAKJI, JUNGMUN, ANDEOK, SEONNYEO, URBAN_COUNTRY),
            Set.of(SEONNYEO.placeId()));
        AiPlanDraft draft = draft(
            day(1, place(GWAKJI), lodging(URBAN_COUNTRY)),
            day(2, place(JUNGMUN), place(SEONNYEO)));

        AiPlanDraft routed = guard.apply(draft);

        assertThat(placeIds(routed, 2)).containsExactly(JUNGMUN.placeId(), SEONNYEO.placeId());
    }

    @Test
    @DisplayName("다른 날에 이미 쓴 후보로는 바꾸지 않는다")
    void doesNotReplaceWithPlaceUsedOnAnotherDay() {
        AiPlanRouteGuard guard = new AiPlanRouteGuard(List.of(GWAKJI, JUNGMUN, ANDEOK, CAMELLIA, SEONNYEO, URBAN_COUNTRY),
            Set.of());
        AiPlanDraft draft = draft(
            day(1, place(GWAKJI), lodging(URBAN_COUNTRY)),
            day(2, place(JUNGMUN), place(SEONNYEO), lodging(URBAN_COUNTRY)),
            day(3, place(ANDEOK)));

        AiPlanDraft routed = guard.apply(draft);

        // 안덕계곡(5.4km)은 3일차에 있다 — 다음으로 가까운 카멜리아힐(6.5km)
        assertThat(routed.days().get(1).items().get(1).placeId()).isEqualTo(CAMELLIA.placeId());
        assertThat(placeIds(routed, 3)).containsExactly(ANDEOK.placeId());
    }

    @Test
    @DisplayName("하루 재생성이면 기존 일정의 다른 날 장소로 바꾸지 않는다 — 초안에는 그날만 있다")
    void doesNotReplaceWithPlaceOfExistingPlan() {
        AiPlanGenerationQuery query = AiPlanGenerationQuery.builder()
            .startDate("2026-10-13")
            .endDate("2026-10-15")
            .regenerateDay(2)
            .planOutline(PlanOutline.builder()
                .planId(7L)
                .days(List.of(PlanOutline.PlanOutlineDay.builder()
                    .day(3)
                    // 산책 코스 아이디는 장소 아이디와 다른 공간이다 — 값이 카멜리아힐과 같아도 후보에서 빼지 않는다
                    .items(List.of(new PlanOutline.PlanOutlineItem("안덕계곡", "PLACE", ANDEOK.placeId()),
                        new PlanOutline.PlanOutlineItem("올레 산책", "WALK", CAMELLIA.placeId())))
                    .build()))
                .build())
            .placeCandidates(List.of(JUNGMUN, ANDEOK, CAMELLIA, SEONNYEO))
            .build();
        AiPlanDraft draft = draft(day(2, place(JUNGMUN), place(SEONNYEO)));

        AiPlanDraft routed = AiPlanRouteGuard.of(query).apply(draft);

        assertThat(placeIds(routed, 1)).containsExactly(JUNGMUN.placeId(), CAMELLIA.placeId());
    }

    @Test
    @DisplayName("그날 권역의 표가 같으면 앞선 점의 권역이 기준이다 — 전날 숙소가 맨 앞, 없으면 첫 방문지")
    void tieGoesToEarlierPoint() {
        AiPlanRouteGuard guard = new AiPlanRouteGuard(List.of(HYEOPJAE, GWAKJI, SEONNYEO, JUNGMUN, MULYEONGARI, ANDEOK,
            URBAN_COUNTRY), Set.of());

        // 북서부(전날 숙소) 1표 : 북동부(선녀와나무꾼) 1표 — 앞선 전날 숙소의 북서부가 기준이라 북동부를 바꾼다
        AiPlanDraft afterStay = draft(
            day(1, place(HYEOPJAE), lodging(URBAN_COUNTRY)),
            day(2, place(SEONNYEO)));
        assertThat(placeIds(guard.apply(afterStay), 2)).containsExactly(GWAKJI.placeId());

        // 북동부(선녀와나무꾼) 1표 : 남서부(중문) 1표, 전날 숙소 없음 — 첫 방문지의 북동부가 기준이라 중문을 바꾼다
        AiPlanDraft firstVisitLeads = draft(day(1, place(SEONNYEO), place(JUNGMUN)));
        assertThat(placeIds(guard.apply(firstVisitLeads), 1)).containsExactly(SEONNYEO.placeId(), MULYEONGARI.placeId());
    }

    @Test
    @DisplayName("연달아 벗어나면 뒤 항목은 바꾼 장소를 직전 점으로 판정하고 바꾼다")
    void consecutiveOffZoneVisitsUseReplacedPlaceAsPrevious() {
        PlaceCandidate cheonjeyeon = visit(17L, "천제연폭포", 33.2520, 126.4180);
        PlaceCandidate sanbang = visit(18L, "산방산", 33.2390, 126.3130);
        // 선녀와나무꾼에서 14.7km — 원래 장소를 직전 점으로 보면 25km 안이라 벗어난 것이 아니다
        PlaceCandidate sehwa = visit(19L, "세화해변", 33.5250, 126.8600);
        AiPlanRouteGuard guard = new AiPlanRouteGuard(List.of(JUNGMUN, CAMELLIA, SEONNYEO, sehwa, ANDEOK, cheonjeyeon, sanbang),
            Set.of());
        // 남서부 3표(중문 · 카멜리아힐 · 안덕계곡) : 북동부 2표
        AiPlanDraft draft = draft(day(1, place(JUNGMUN), place(CAMELLIA), place(SEONNYEO), place(sehwa), place(ANDEOK)));

        AiPlanDraft routed = guard.apply(draft);

        // 선녀와나무꾼 → 카멜리아힐에서 가장 가까운 천제연폭포, 세화해변 → 천제연폭포에서 가장 가까운 남은 후보 산방산
        assertThat(placeIds(routed, 1)).containsExactly(JUNGMUN.placeId(), CAMELLIA.placeId(), cheonjeyeon.placeId(),
            sanbang.placeId(), ANDEOK.placeId());
    }

    @Test
    @DisplayName("첫 항목이 벗어나고 전날 숙소가 없으면 다음 장소를 기준으로 바꾼다")
    void replacesOffZoneFirstVisit() {
        AiPlanRouteGuard guard = new AiPlanRouteGuard(List.of(SEONNYEO, JUNGMUN, ANDEOK, CAMELLIA, JEONGBANG), Set.of());
        AiPlanDraft draft = draft(day(1, place(SEONNYEO), place(JUNGMUN), place(ANDEOK)));

        AiPlanDraft routed = guard.apply(draft);

        // 중문 기준 가장 가까운 미사용 후보 — 카멜리아힐 6.5km, 정방폭포(남부, 남서부와 맞닿음) 14.8km
        assertThat(placeIds(routed, 1)).containsExactly(CAMELLIA.placeId(), JUNGMUN.placeId(), ANDEOK.placeId());
    }

    private static AiPlanRouteGuard guard(Set<Long> protectedPlaceIds) {
        return new AiPlanRouteGuard(CANDIDATES, protectedPlaceIds);
    }

    private static PlaceCandidate candidate(long id, String title, String contentType, boolean indoor, double lat, double lng) {
        return new PlaceCandidate(id, title, contentType, "제주", "동반 가능", null, null, indoor, null, lat, lng);
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

    private static AiPlanDraftItem meal(PlaceCandidate place) {
        return AiPlanDraftItem.builder().itemType(PlanItemType.MEAL).placeId(place.placeId()).title(place.title())
            .note("점심을 먹어요.").build();
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

    /** 전날 숙소에서 시작해 그날 항목을 잇는 구간 중 가장 긴 직선거리. */
    private static double maxLegMeters(AiPlanDraft draft, int day, PlaceCandidate previousStay) {
        Map<Long, PlaceCandidate> byId = new HashMap<>();
        List.of(GWAKJI, SUWOLBONG, ANDEOK, JUNGMUN, JEONGBANG, SEOGWIPO_PENSION, DONNAEKO_RESORT, GUJWA_HOUSE, URBAN_COUNTRY,
            SEONNYEO, BONTAE, CAMELLIA).forEach(place -> byId.put(place.placeId(), place));
        PlaceCandidate from = previousStay;
        double max = 0d;
        for (AiPlanDraftItem item : draft.days().get(day - 1).items()) {
            PlaceCandidate to = byId.get(item.placeId());
            max = Math.max(max, GeoDistance.meters(from.lat(), from.lng(), to.lat(), to.lng()));
            from = to;
        }
        return max;
    }

    private static List<Long> placeIds(AiPlanDraft draft, int day) {
        return draft.days().get(day - 1).items().stream().map(AiPlanDraftItem::placeId).toList();
    }
}
