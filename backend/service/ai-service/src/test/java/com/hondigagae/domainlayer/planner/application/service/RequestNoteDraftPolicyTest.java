package com.hondigagae.domainlayer.planner.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.planner.application.model.AiPlanGenerationQuery;
import com.hondigagae.domainlayer.planner.application.model.PlaceCandidate;
import com.hondigagae.domainlayer.planner.application.model.PlanOutline;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft.AiPlanDraftDay;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft.AiPlanDraftItem;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft.AiPlanDraftReason;
import com.hondigagae.shared.travel.plan.PlanItemType;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * 명시 요청을 초안에 맞추고 근거로 말하는지 (#1170 · #1423).
 *
 * <p>#1170 은 후보 풀에 실내 카페가 <b>있기만 하면</b> 충족으로 쳤다 — 초안에 날마다 들어갔는지 보지 않았다. 실측 문구는
 * "오전엔 바다 보며 산책하고 오후엔 실내 카페에서 쉬고 싶어요" 와 "성산 쪽 위주로 다니고 싶어요".
 */
class RequestNoteDraftPolicyTest {

    private static final String INDOOR_CAFE_NOTE = "오전엔 바다 보며 산책하고 오후엔 실내 카페에서 쉬고 싶어요";
    private static final String SEONGSAN_NOTE = "성산 쪽 위주로 다니고 싶어요";

    // 북서부(애월 · 한림)
    private static final PlaceCandidate GWAKJI = place(11L, "곽지해수욕장", "관광지", false, null, 33.4505, 126.3053);
    private static final PlaceCandidate HALLIM_PARK = place(12L, "한림공원", "관광지", false, null, 33.3894, 126.2394);
    private static final PlaceCandidate AEWOL_CAFE = place(13L, "애월 실내 카페", "음식점", true, "카페", 33.4600, 126.3100);
    private static final PlaceCandidate AEWOL_STAY = place(14L, "애월 펜션", "숙박", true, "펜션", 33.4400, 126.3200);
    // 북동부(성산)
    private static final PlaceCandidate SUNRISE_PEAK = place(21L, "성산일출봉", "관광지", false, null, 33.4580, 126.9425);
    private static final PlaceCandidate SEOPJIKOJI = place(22L, "섭지코지", "관광지", false, null, 33.4240, 126.9310);
    private static final PlaceCandidate SEONGSAN_CAFE = place(23L, "성산 실내 카페", "음식점", true, "카페", 33.4500, 126.9200);
    private static final PlaceCandidate AQUA_PLANET = place(24L, "아쿠아플라넷", "문화시설", true, null, 33.4330, 126.9270);
    // 남부(서귀포) — 애월에서 30km 넘게 떨어진 실내 카페
    private static final PlaceCandidate SEOGWIPO_CAFE = place(31L, "서귀포 실내 카페", "음식점", true, "카페", 33.2500, 126.5600);

    @Nested
    @DisplayName("실내 · 카페 (#1423)")
    class IndoorCafe {

        @Test
        @DisplayName("실내 카페가 없는 날에 가장 가까운 후보를 기준점(가장 가까운 그날 항목) 뒤에 넣는다 — 숙박은 끝에 남고, 넣은 장소는 식사 · 서버 메모다")
        void fillsTheDayAfterItsAnchor() {
            AiPlanDraft draft = draft(
                day(1, item(PlanItemType.PLACE, GWAKJI), item(PlanItemType.PLACE, HALLIM_PARK), item(PlanItemType.LODGING, AEWOL_STAY)),
                day(2, item(PlanItemType.PLACE, SUNRISE_PEAK), item(PlanItemType.MEAL, SEONGSAN_CAFE)));
            AiPlanGenerationQuery query = query(INDOOR_CAFE_NOTE,
                List.of(GWAKJI, HALLIM_PARK, AEWOL_CAFE, AEWOL_STAY, SUNRISE_PEAK, SEONGSAN_CAFE, SEOGWIPO_CAFE));

            AiPlanDraft applied = RequestNoteDraftPolicy.apply(draft, query);

            // 애월 카페에서 가장 가까운 그날 항목이 곽지(1.1km)라 곽지 바로 뒤다
            assertThat(applied.days().get(0).items()).extracting(AiPlanDraftItem::placeId).containsExactly(11L, 13L, 12L, 14L);
            AiPlanDraftItem filled = applied.days().get(0).items().get(1);
            assertThat(filled.itemType()).isEqualTo(PlanItemType.MEAL);
            assertThat(filled.title()).isEqualTo("애월 실내 카페");
            assertThat(filled.note()).isEqualTo("요청하신 실내 카페예요.");
            // 이미 있는 날은 손대지 않는다
            assertThat(applied.days().get(1)).isSameAs(draft.days().get(1));
            assertThat(applied.reasons()).first().satisfies(reason -> {
                assertThat(reason.code()).isEqualTo("REQUEST_APPLIED");
                assertThat(reason.name()).isEqualTo("요청 반영");
                assertThat(reason.description()).isEqualTo("요청하신 실내 카페를 날마다 넣었어요.");
            });
        }

        @Test
        @DisplayName("20km 를 잰 기준점 바로 뒤에 넣는다 — 첫 방문 뒤에 넣으면 협재 → 함덕 → 애월(43km · 35km)이 됐다")
        void fillsRightAfterTheAnchorNotTheFirstVisit() {
            PlaceCandidate hyeopjae = place(41L, "협재해수욕장", "관광지", false, null, 33.3940, 126.2397);
            PlaceCandidate aewolCoast = place(42L, "애월 해안도로", "관광지", false, null, 33.4700, 126.3200);
            PlaceCandidate dongmun = place(43L, "동문시장", "음식점", false, "시장", 33.5120, 126.5270);
            PlaceCandidate hamdeokIndoor = place(44L, "함덕 실내 놀이터", "관광지", true, null, 33.5430, 126.6690);
            AiPlanDraft draft = draft(day(1, item(PlanItemType.PLACE, hyeopjae), item(PlanItemType.PLACE, aewolCoast),
                item(PlanItemType.MEAL, dongmun), item(PlanItemType.LODGING, AEWOL_STAY)));

            AiPlanDraft applied = RequestNoteDraftPolicy.apply(draft,
                query("비 오면 실내에서 쉬고 싶어요", List.of(hyeopjae, aewolCoast, dongmun, AEWOL_STAY, hamdeokIndoor)));

            // 함덕은 동문시장에서 13.6km — 그 뒤, 숙소 앞이다
            assertThat(applied.days().get(0).items()).extracting(AiPlanDraftItem::placeId).containsExactly(41L, 42L, 43L, 44L, 14L);
        }

        @Test
        @DisplayName("기준점이 숙박이면 그 숙박 바로 앞에 넣는다 — 숙박은 그날 끝에 남는다")
        void fillsBeforeTheLodgingWhenItIsTheAnchor() {
            AiPlanDraft draft = draft(day(1, item(PlanItemType.PLACE, SUNRISE_PEAK), item(PlanItemType.PLACE, SEOPJIKOJI),
                item(PlanItemType.LODGING, AEWOL_STAY)));

            AiPlanDraft applied = RequestNoteDraftPolicy.apply(draft,
                query(INDOOR_CAFE_NOTE, List.of(SUNRISE_PEAK, SEOPJIKOJI, AEWOL_STAY, AEWOL_CAFE)));

            // 애월 카페는 숙소에서 2.4km, 성산 쪽 두 곳에서는 60km 남짓이다
            assertThat(applied.days().get(0).items()).extracting(AiPlanDraftItem::placeId).containsExactly(21L, 22L, 13L, 14L);
        }

        @Test
        @DisplayName("20km 경계 — 19.9km 는 넣고 20.1km 는 넣지 않는다")
        void fillsWithinTwentyKilometersOnly() {
            PlaceCandidate origin = place(51L, "기준 장소", "관광지", false, null, 33.3000, 126.5000);
            // 자오선을 따라 위도 0.1790° = 19,904m, 0.1808° = 20,104m
            PlaceCandidate inside = place(52L, "19.9km 실내", "문화시설", true, null, 33.4790, 126.5000);
            PlaceCandidate outside = place(53L, "20.1km 실내", "문화시설", true, null, 33.4808, 126.5000);
            AiPlanDraft draft = draft(day(1, item(PlanItemType.PLACE, origin)));

            AiPlanDraft near = RequestNoteDraftPolicy.apply(draft, query("실내 위주로", List.of(origin, inside)));
            AiPlanDraft far = RequestNoteDraftPolicy.apply(draft, query("실내 위주로", List.of(origin, outside)));

            assertThat(near.days().get(0).items()).extracting(AiPlanDraftItem::placeId).containsExactly(51L, 52L);
            assertThat(far.days()).isSameAs(draft.days());
            assertThat(far.reasons().get(0).code()).isEqualTo("REQUEST_UNMET");
        }

        @Test
        @DisplayName("방문 항목이 있는 날만 센다 — 숙박만 있는 날이 섞여도 \"날마다\" 는 방문한 날 수로 정한다")
        void countsOnlyDaysWithVisits() {
            PlaceCandidate seopjiCafe = place(26L, "섭지 실내 카페", "음식점", true, "카페", 33.4250, 126.9300);
            List<PlaceCandidate> pool = List.of(SUNRISE_PEAK, SEOPJIKOJI, SEONGSAN_CAFE, AEWOL_STAY, seopjiCafe);
            AiPlanDraft twoVisitDays = draft(
                day(1, item(PlanItemType.PLACE, SUNRISE_PEAK), item(PlanItemType.MEAL, SEONGSAN_CAFE)),
                day(2, item(PlanItemType.LODGING, AEWOL_STAY)),
                day(3, item(PlanItemType.PLACE, SEOPJIKOJI), item(PlanItemType.MEAL, seopjiCafe)));
            AiPlanDraft oneVisitDay = draft(
                day(1, item(PlanItemType.PLACE, SUNRISE_PEAK), item(PlanItemType.MEAL, SEONGSAN_CAFE)),
                day(2, item(PlanItemType.LODGING, AEWOL_STAY)));

            assertThat(RequestNoteDraftPolicy.apply(twoVisitDays, query(INDOOR_CAFE_NOTE, pool)).reasons().get(0).description())
                .isEqualTo("요청하신 실내 카페를 날마다 넣었어요.");
            assertThat(RequestNoteDraftPolicy.apply(oneVisitDay, query(INDOOR_CAFE_NOTE, pool)).reasons().get(0).description())
                .isEqualTo("요청하신 실내 카페를 넣었어요.");
        }

        @Test
        @DisplayName("부정된 요청(\"카페 말고 바다 위주로\")은 넣지도 말하지도 않는다")
        void ignoresNegatedRequest() {
            AiPlanDraft draft = draft(day(1, item(PlanItemType.PLACE, GWAKJI)));

            assertThat(RequestNoteDraftPolicy.apply(draft, query("카페 말고 바다 위주로", List.of(GWAKJI, AEWOL_CAFE)))).isSameAs(draft);
            assertThat(RequestNoteDraftPolicy.apply(draft, query("카페는 별로예요", List.of(GWAKJI, AEWOL_CAFE)))).isSameAs(draft);
            assertThat(RequestNoteDraftPolicy.apply(draft, query("실내견이라 바다 위주로", List.of(GWAKJI, AQUA_PLANET)))).isSameAs(draft);
        }

        @Test
        @DisplayName("이미 들어간 날은 넣지 않고, 하루짜리면 \"넣었어요\" 라고 말한다")
        void doesNotFillWhenAlreadyThere() {
            AiPlanDraft draft = draft(day(1, item(PlanItemType.PLACE, SUNRISE_PEAK), item(PlanItemType.MEAL, SEONGSAN_CAFE)));

            AiPlanDraft applied = RequestNoteDraftPolicy.apply(draft, query(INDOOR_CAFE_NOTE, List.of(SUNRISE_PEAK, SEONGSAN_CAFE)));

            assertThat(applied.days()).isSameAs(draft.days());
            assertThat(applied.reasons()).extracting(AiPlanDraftReason::description)
                .containsExactly("요청하신 실내 카페를 넣었어요.", "반려견 동반이 가능한 곳만 골랐어요.");
        }

        @Test
        @DisplayName("이미 쓴 장소와 20km 밖은 넣지 않고, 못 넣은 날을 말하며 넣었다고 하는 모델 근거는 뺀다")
        void reportsTheDayItCouldNotFill() {
            // 애월 카페는 가깝지만 2일차에 이미 있고, 성산 카페는 60km 밖이다
            AiPlanDraft draft = AiPlanDraft.builder()
                .days(List.of(
                    day(1, item(PlanItemType.PLACE, GWAKJI), item(PlanItemType.PLACE, HALLIM_PARK), item(PlanItemType.LODGING, AEWOL_STAY)),
                    day(2, item(PlanItemType.PLACE, SUNRISE_PEAK), item(PlanItemType.MEAL, AEWOL_CAFE))))
                .reasons(List.of(
                    reason("REST_SLOT", "1일차 오후에는 실내 카페에서 쉬어요."),
                    reason("PET_ALLOWED", "반려견 동반이 가능한 곳만 골랐어요.")))
                .build();
            AiPlanGenerationQuery query = query(INDOOR_CAFE_NOTE,
                List.of(GWAKJI, HALLIM_PARK, AEWOL_CAFE, AEWOL_STAY, SUNRISE_PEAK, SEONGSAN_CAFE));

            AiPlanDraft applied = RequestNoteDraftPolicy.apply(draft, query);

            assertThat(applied.days()).isSameAs(draft.days());
            assertThat(applied.reasons()).extracting(AiPlanDraftReason::code).containsExactly("REQUEST_UNMET", "PET_ALLOWED");
            assertThat(applied.reasons().get(0).description())
                .isEqualTo("요청하신 실내 카페를 1일차에는 넣지 못했어요. 그날 동선 근처에 맞는 후보가 없었어요.");
        }

        @Test
        @DisplayName("못 넣은 날이 여럿이면 일차를 가운뎃점으로 잇는다")
        void listsEveryUnfilledDay() {
            AiPlanDraft draft = draft(
                day(1, item(PlanItemType.PLACE, GWAKJI)),
                day(2, item(PlanItemType.PLACE, SUNRISE_PEAK), item(PlanItemType.MEAL, SEONGSAN_CAFE)),
                day(3, item(PlanItemType.PLACE, HALLIM_PARK)));
            AiPlanGenerationQuery query = query(INDOOR_CAFE_NOTE,
                List.of(GWAKJI, HALLIM_PARK, SUNRISE_PEAK, SEONGSAN_CAFE, SEOGWIPO_CAFE));

            AiPlanDraft applied = RequestNoteDraftPolicy.apply(draft, query);

            assertThat(applied.reasons().get(0).description())
                .isEqualTo("요청하신 실내 카페를 1일차 · 3일차에는 넣지 못했어요. 그날 동선 근처에 맞는 후보가 없었어요.");
        }

        @Test
        @DisplayName("후보 풀에 아예 없으면 #1170 문구 그대로 없다고 말하고 넣었다는 근거는 뺀다")
        void saysTheRequestIsMissingFromCandidates() {
            AiPlanDraft draft = AiPlanDraft.builder()
                .days(List.of(day(1, item(PlanItemType.PLACE, GWAKJI))))
                .reasons(List.of(
                    reason("REST_SLOT", "각 일자마다 산책 후 휴식 장소를 배치해요."),
                    reason("PET_ALLOWED", "반려견 동반이 가능한 곳만 골랐어요.")))
                .build();
            AiPlanGenerationQuery query = query(INDOOR_CAFE_NOTE, List.of(GWAKJI, AEWOL_STAY));

            AiPlanDraft applied = RequestNoteDraftPolicy.apply(draft, query);

            assertThat(applied.days()).isSameAs(draft.days());
            assertThat(applied.reasons()).extracting(AiPlanDraftReason::code).containsExactly("REQUEST_UNMET", "PET_ALLOWED");
            assertThat(applied.reasons().get(0).name()).isEqualTo("요청 반영");
            assertThat(applied.reasons().get(0).description()).isEqualTo("요청하신 실내 카페가 이번 후보에 없어요.");
        }

        @Test
        @DisplayName("실내만 요청하면 실내 장소를 장소 항목으로, 카페만 요청하면 카페를 넣는다 — 문구도 요청을 따른다")
        void fillsIndoorOrCafeAsRequested() {
            AiPlanDraft draft = draft(day(1, item(PlanItemType.PLACE, SUNRISE_PEAK), item(PlanItemType.PLACE, SEOPJIKOJI)));
            List<PlaceCandidate> pool = List.of(SUNRISE_PEAK, SEOPJIKOJI, SEONGSAN_CAFE, AQUA_PLANET);

            AiPlanDraft indoor = RequestNoteDraftPolicy.apply(draft, query("비 오면 실내에서 쉬고 싶어요", pool));
            AiPlanDraft cafe = RequestNoteDraftPolicy.apply(draft, query("카페 가고 싶어요", pool));

            // 섭지코지에서 아쿠아플라넷이 1km, 성산 카페는 2km 남짓이라 실내 요청은 아쿠아플라넷이고 기준점 섭지코지 뒤에 든다
            assertThat(indoor.days().get(0).items()).extracting(AiPlanDraftItem::placeId).containsExactly(21L, 22L, 24L);
            AiPlanDraftItem indoorFill = indoor.days().get(0).items().get(2);
            assertThat(indoorFill.placeId()).isEqualTo(24L);
            assertThat(indoorFill.itemType()).isEqualTo(PlanItemType.PLACE);
            assertThat(indoorFill.note()).isEqualTo("요청하신 실내 장소예요.");
            assertThat(indoor.reasons().get(0).description()).isEqualTo("요청하신 실내 장소를 넣었어요.");

            // 성산 카페는 일출봉(2.3km)이 섭지코지(3.1km)보다 가까워 일출봉 뒤다
            AiPlanDraftItem cafeFill = cafe.days().get(0).items().get(1);
            assertThat(cafeFill.placeId()).isEqualTo(23L);
            assertThat(cafeFill.itemType()).isEqualTo(PlanItemType.MEAL);
            assertThat(cafeFill.note()).isEqualTo("요청하신 카페예요.");
            assertThat(cafe.reasons().get(0).description()).isEqualTo("요청하신 카페를 넣었어요.");
        }

        @Test
        @DisplayName("거리가 같으면 후보 목록 앞의 것을 넣는다")
        void prefersEarlierCandidateOnTie() {
            PlaceCandidate twin = place(25L, "아쿠아플라넷 별관", "문화시설", true, null, 33.4330, 126.9270);
            AiPlanDraft draft = draft(day(1, item(PlanItemType.PLACE, SEOPJIKOJI)));

            AiPlanDraft applied = RequestNoteDraftPolicy.apply(draft, query("실내 위주로", List.of(SEOPJIKOJI, twin, AQUA_PLANET)));

            assertThat(applied.days().get(0).items()).extracting(AiPlanDraftItem::placeId).containsExactly(22L, 25L);
        }

        @Test
        @DisplayName("넣은 장소는 다음 날 후보에서 뺀다 — 같은 장소를 두 날에 넣지 않는다")
        void doesNotFillTheSamePlaceTwice() {
            AiPlanDraft draft = draft(
                day(1, item(PlanItemType.PLACE, GWAKJI)),
                day(2, item(PlanItemType.PLACE, HALLIM_PARK)));

            AiPlanDraft applied = RequestNoteDraftPolicy.apply(draft, query(INDOOR_CAFE_NOTE, List.of(GWAKJI, HALLIM_PARK, AEWOL_CAFE)));

            assertThat(applied.days().get(0).items()).extracting(AiPlanDraftItem::placeId).containsExactly(11L, 13L);
            assertThat(applied.days().get(1).items()).extracting(AiPlanDraftItem::placeId).containsExactly(12L);
            assertThat(applied.reasons().get(0).description())
                .isEqualTo("요청하신 실내 카페를 2일차에는 넣지 못했어요. 그날 동선 근처에 맞는 후보가 없었어요.");
        }

        @Test
        @DisplayName("방문 항목이 있는 날이 없으면 말할 것이 없다 — 초안 그대로다")
        void leavesDraftWithoutVisitDays() {
            AiPlanDraft draft = AiPlanDraft.builder()
                .days(List.of())
                .reasons(List.of(reason("PET_ALLOWED", "반려견 동반이 가능한 곳만 골랐어요.")))
                .build();

            assertThat(RequestNoteDraftPolicy.apply(draft, query(INDOOR_CAFE_NOTE, List.of(SEONGSAN_CAFE)))).isSameAs(draft);
        }
    }

    @Nested
    @DisplayName("지역 (#1423)")
    class Region {

        @Test
        @DisplayName("요청 권역 자체가 방문 항목의 절반 이상이면 위주로 골랐다고 말한다 — 숙박은 세지 않는다")
        void saysTheRegionWasApplied() {
            // 방문 넷 중 북동부 둘 — 딱 절반이다. 북서부 숙소까지 세면 다섯 중 둘이라 결과가 뒤집힌다
            AiPlanDraft draft = draft(
                day(1, item(PlanItemType.PLACE, SUNRISE_PEAK), item(PlanItemType.PLACE, SEOPJIKOJI),
                    item(PlanItemType.LODGING, AEWOL_STAY)),
                day(2, item(PlanItemType.PLACE, GWAKJI), item(PlanItemType.PLACE, HALLIM_PARK)));

            AiPlanDraft applied = RequestNoteDraftPolicy.apply(draft,
                query(SEONGSAN_NOTE, List.of(SUNRISE_PEAK, SEOPJIKOJI, AEWOL_STAY, GWAKJI, HALLIM_PARK)));

            assertThat(applied.days()).isSameAs(draft.days());
            assertThat(applied.reasons()).first().satisfies(reason -> {
                assertThat(reason.code()).isEqualTo("REQUEST_APPLIED");
                assertThat(reason.name()).isEqualTo("요청 반영");
                assertThat(reason.description()).isEqualTo("요청하신 지역(성산) 위주로 골랐어요.");
            });
        }

        @Test
        @DisplayName("요청 권역이 절반에 못 미치면 원인을 단정하지 않고 지역 밖도 넣었다고 말한다 — 맞닿은 권역은 세지 않는다")
        void saysTheRegionWasNotMet() {
            // 성산의 맞닿은 권역(북부)인 제주 시내 두 곳은 요청 권역이 아니다
            PlaceCandidate dongmun = place(43L, "동문시장", "음식점", false, "시장", 33.5120, 126.5270);
            PlaceCandidate yongduam = place(45L, "용두암", "관광지", false, null, 33.5163, 126.5119);
            AiPlanDraft draft = draft(
                day(1, item(PlanItemType.PLACE, yongduam), item(PlanItemType.MEAL, dongmun)),
                day(2, item(PlanItemType.PLACE, SUNRISE_PEAK)));

            AiPlanDraft applied = RequestNoteDraftPolicy.apply(draft,
                query(SEONGSAN_NOTE, List.of(yongduam, dongmun, SUNRISE_PEAK)));

            assertThat(applied.reasons()).first().satisfies(reason -> {
                assertThat(reason.code()).isEqualTo("REQUEST_UNMET");
                assertThat(reason.description()).isEqualTo("요청하신 지역(성산) 밖의 장소도 함께 넣었어요.");
            });
        }

        @Test
        @DisplayName("방문 항목이 없으면 지역 근거를 싣지 않는다")
        void skipsRegionWithoutVisits() {
            AiPlanDraft draft = draft(day(1, item(PlanItemType.LODGING, AEWOL_STAY)));

            assertThat(RequestNoteDraftPolicy.apply(draft, query(SEONGSAN_NOTE, List.of(AEWOL_STAY)))).isSameAs(draft);
        }
    }

    @Test
    @DisplayName("서버 근거(실내 · 카페 → 지역)를 맨 앞에 두고 모델 근거를 이어 3개에서 자른다")
    void putsServerReasonsFirstAndCapsAtThree() {
        AiPlanDraft draft = AiPlanDraft.builder()
            .days(List.of(day(1, item(PlanItemType.PLACE, SUNRISE_PEAK), item(PlanItemType.PLACE, SEOPJIKOJI))))
            .reasons(List.of(
                reason("PET_ALLOWED", "반려견 동반이 가능한 곳만 골랐어요."),
                reason("WEATHER_OK", "1일차는 맑아 바닷가를 걸어요."),
                reason("PET_TRAIT", "사람을 불편해하는 아이라 넓은 곳을 골랐어요.")))
            .build();

        AiPlanDraft applied = RequestNoteDraftPolicy.apply(draft,
            query("성산 쪽에서 실내 카페 가고 싶어요", List.of(SUNRISE_PEAK, SEOPJIKOJI, SEONGSAN_CAFE, AQUA_PLANET, GWAKJI)));

        assertThat(applied.days().get(0).items()).extracting(AiPlanDraftItem::placeId).containsExactly(21L, 23L, 22L);
        assertThat(applied.reasons()).extracting(AiPlanDraftReason::description).containsExactly(
            "요청하신 실내 카페를 넣었어요.", "요청하신 지역(성산) 위주로 골랐어요.", "반려견 동반이 가능한 곳만 골랐어요.");
        assertThat(applied.reasons()).extracting(AiPlanDraftReason::name).startsWith("요청 반영", "요청 반영");
    }

    @Test
    @DisplayName("실내 · 카페를 못 맞추고 지역은 맞췄으면 그 순서로 앞에 두고, 넣었다고 하는 모델 근거는 빼고 3개에서 자른다")
    void assemblesUnmetIndoorWithAppliedRegion() {
        AiPlanDraft draft = AiPlanDraft.builder()
            .days(List.of(day(1, item(PlanItemType.PLACE, SUNRISE_PEAK), item(PlanItemType.PLACE, SEOPJIKOJI))))
            .reasons(List.of(
                reason("REST_SLOT", "오후에는 실내 카페에서 쉬어요."),
                reason("PET_ALLOWED", "반려견 동반이 가능한 곳만 골랐어요."),
                reason("WEATHER_OK", "1일차는 맑아 바닷가를 걸어요.")))
            .build();

        // 실내 카페는 애월에만 있다 — 성산에서 60km 남짓이라 넣지 못한다
        AiPlanDraft applied = RequestNoteDraftPolicy.apply(draft,
            query("성산 쪽에서 실내 카페 가고 싶어요", List.of(SUNRISE_PEAK, SEOPJIKOJI, AEWOL_CAFE)));

        assertThat(applied.days()).isSameAs(draft.days());
        assertThat(applied.reasons()).extracting(AiPlanDraftReason::code)
            .containsExactly("REQUEST_UNMET", "REQUEST_APPLIED", "PET_ALLOWED");
        assertThat(applied.reasons()).extracting(AiPlanDraftReason::description).containsExactly(
            "요청하신 실내 카페를 1일차에는 넣지 못했어요. 그날 동선 근처에 맞는 후보가 없었어요.",
            "요청하신 지역(성산) 위주로 골랐어요.",
            "반려견 동반이 가능한 곳만 골랐어요.");
    }

    @Test
    @DisplayName("실내 · 카페도 지역도 묻지 않으면 초안 그대로다")
    void leavesDraftWithoutRequest() {
        AiPlanDraft draft = draft(day(1, item(PlanItemType.PLACE, GWAKJI)));

        assertThat(RequestNoteDraftPolicy.apply(draft, query("바다 보며 산책하고 싶어요", List.of(GWAKJI, AEWOL_CAFE)))).isSameAs(draft);
        assertThat(RequestNoteDraftPolicy.apply(draft, query(null, List.of(GWAKJI)))).isSameAs(draft);
    }

    @Test
    @DisplayName("하루 재생성이면 지역을 보지 않고, 실내 · 카페는 기존 일정에 있는 장소를 넣지 않는다")
    void regenerationIgnoresRegionAndSkipsOutlinePlaces() {
        PlanOutline outline = PlanOutline.builder().planId(7L).days(List.of(
            PlanOutline.PlanOutlineDay.builder().day(1).items(List.of(
                PlanOutline.PlanOutlineItem.builder().title("애월 실내 카페").itemType("MEAL").placeId(13L).build())).build()))
            .build();
        AiPlanDraft draft = draft(day(2, item(PlanItemType.PLACE, GWAKJI), item(PlanItemType.PLACE, HALLIM_PARK)));

        AiPlanDraft regionOnly = RequestNoteDraftPolicy.apply(draft,
            regenerate(SEONGSAN_NOTE, List.of(GWAKJI, HALLIM_PARK, AEWOL_CAFE), outline));
        AiPlanDraft withCafe = RequestNoteDraftPolicy.apply(draft,
            regenerate("성산 쪽에서 실내 카페 가고 싶어요", List.of(GWAKJI, HALLIM_PARK, AEWOL_CAFE, SEOGWIPO_CAFE), outline));

        assertThat(regionOnly).isSameAs(draft);
        assertThat(withCafe.days()).isSameAs(draft.days());
        // 지역 근거는 없다 — 실내 카페 근거 다음은 모델 근거다
        assertThat(withCafe.reasons()).extracting(AiPlanDraftReason::description).containsExactly(
            "요청하신 실내 카페를 2일차에는 넣지 못했어요. 그날 동선 근처에 맞는 후보가 없었어요.", "반려견 동반이 가능한 곳만 골랐어요.");
    }

    @Test
    @DisplayName("기존 일정의 산책(WALK) 항목은 쓴 장소로 세지 않는다 — 그 아이디는 산책 코스 아이디다")
    void regenerationDoesNotTreatWalkIdsAsPlaces() {
        // 산책 코스 13 은 장소 13(애월 실내 카페)과 아이디만 같다
        PlanOutline outline = PlanOutline.builder().planId(7L).days(List.of(
            PlanOutline.PlanOutlineDay.builder().day(1).items(List.of(
                PlanOutline.PlanOutlineItem.builder().title("애월 해안 산책로").itemType("WALK").placeId(13L).build())).build()))
            .build();
        AiPlanDraft draft = draft(day(2, item(PlanItemType.PLACE, GWAKJI), item(PlanItemType.PLACE, HALLIM_PARK)));

        AiPlanDraft applied = RequestNoteDraftPolicy.apply(draft,
            regenerate(INDOOR_CAFE_NOTE, List.of(GWAKJI, HALLIM_PARK, AEWOL_CAFE), outline));

        assertThat(applied.days().get(0).items()).extracting(AiPlanDraftItem::placeId).containsExactly(11L, 13L, 12L);
    }

    private static AiPlanGenerationQuery query(String note, List<PlaceCandidate> pool) {
        return AiPlanGenerationQuery.builder().requestNote(note).placeCandidates(pool).build();
    }

    private static AiPlanGenerationQuery regenerate(String note, List<PlaceCandidate> pool, PlanOutline outline) {
        return AiPlanGenerationQuery.builder()
            .requestNote(note).placeCandidates(pool).regenerateDay(2).planOutline(outline)
            .build();
    }

    /** 모델 근거 하나("반려견 동반이 가능한 곳만 골랐어요.")가 붙은 초안. */
    private static AiPlanDraft draft(AiPlanDraftDay... days) {
        return AiPlanDraft.builder()
            .days(List.of(days))
            .reasons(List.of(reason("PET_ALLOWED", "반려견 동반이 가능한 곳만 골랐어요.")))
            .build();
    }

    private static AiPlanDraftDay day(int day, AiPlanDraftItem... items) {
        return AiPlanDraftDay.builder().day(day).items(List.of(items)).build();
    }

    private static AiPlanDraftItem item(PlanItemType itemType, PlaceCandidate place) {
        return AiPlanDraftItem.builder()
            .itemType(itemType).placeId(place.placeId()).title(place.title()).note("모델이 쓴 메모예요.")
            .build();
    }

    private static PlaceCandidate place(
        long id, String title, String contentType, boolean indoor, String category, double lat, double lng
    ) {
        return PlaceCandidate.builder()
            .placeId(id)
            .title(title)
            .contentTypeName(contentType)
            .petAllowanceName("동반 가능")
            .indoor(indoor)
            .sourceCategory(category)
            .lat(lat)
            .lng(lng)
            .build();
    }

    private static AiPlanDraftReason reason(String code, String description) {
        return AiPlanDraftReason.builder().code(code).name(code).description(description).build();
    }
}
