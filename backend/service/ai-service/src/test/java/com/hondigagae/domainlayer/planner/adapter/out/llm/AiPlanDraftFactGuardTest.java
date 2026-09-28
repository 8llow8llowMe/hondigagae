package com.hondigagae.domainlayer.planner.adapter.out.llm;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.planner.application.model.PlaceCandidate;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft.AiPlanDraftDay;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft.AiPlanDraftItem;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft.AiPlanDraftReason;
import com.hondigagae.shared.travel.plan.PlanItemType;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * 초안 사실 대조 규칙 (#975). 규칙마다 <b>걷어야 하는 쪽과 남겨야 하는 쪽</b>을 함께 밟는다 —
 * 한쪽만 보면 "무엇이든 지우는" 구현도 통과한다.
 */
class AiPlanDraftFactGuardTest {

    private static final PlaceCandidate CONDO = place(1L, "휘닉스아일랜드콘도", "숙박", true);
    private static final PlaceCandidate CAFE = place(2L, "N109", "음식점", true);
    private static final PlaceCandidate BEACH = place(3L, "함덕해수욕장", "관광지", false);
    private static final PlaceCandidate MUSEUM = place(4L, "제주도립미술관", "문화시설", true);

    private static final Map<Long, PlaceCandidate> CANDIDATES = Map.of(
        CONDO.placeId(), CONDO, CAFE.placeId(), CAFE, BEACH.placeId(), BEACH, MUSEUM.placeId(), MUSEUM);

    @Nested
    @DisplayName("마지막 날 숙박")
    class LastDayLodging {

        @Test
        @DisplayName("1박 2일의 2일차 숙박은 빠지고 1일차 숙박은 남는다")
        void dropsLodgingOnlyOnTheLastDay() {
            AiPlanDraft draft = draft(List.of(
                day(1, lodging(CONDO)),
                day(2, visit(BEACH, "바다를 보며 걸어요."), lodging(CONDO))), List.of());

            AiPlanDraft guarded = guard(2, Map.of()).apply(draft);

            assertThat(itemTypes(guarded, 1)).containsExactly(PlanItemType.LODGING);
            assertThat(itemTypes(guarded, 2)).containsExactly(PlanItemType.PLACE);
        }

        @Test
        @DisplayName("당일치기는 1일차가 마지막 날이다")
        void dayTripHasNoLodging() {
            AiPlanDraft draft = draft(List.of(day(1, visit(MUSEUM, "그림을 봐요."), lodging(CONDO))), List.of());

            AiPlanDraft guarded = guard(1, Map.of()).apply(draft);

            assertThat(itemTypes(guarded, 1)).containsExactly(PlanItemType.PLACE);
        }
    }

    @Nested
    @DisplayName("확인할 수 없는 근거")
    class UnverifiableReasons {

        @Test
        @DisplayName("거리 · 혼잡 코드의 근거는 통째로 빠진다 — 모델은 거리와 혼잡도를 본 적이 없다")
        void dropsDistanceAndCongestionCodes() {
            AiPlanDraft draft = draft(List.of(day(1)), List.of(
                reason("SHORT_DISTANCE", "각 일정 간 이동 거리가 짧아 반려견이 덜 지쳐요."),
                reason("LOW_CONGESTION", "평일이라 한적해요."),
                reason("PET_ALLOWED", "모든 장소가 반려견 동반 가능이에요.")));

            AiPlanDraft guarded = guard(1, Map.of()).apply(draft);

            assertThat(guarded.reasons()).extracting(AiPlanDraftReason::code).containsExactly("PET_ALLOWED");
        }

        @Test
        @DisplayName("다른 근거 안의 거리 문장만 걷고 나머지 문장은 남긴다")
        void trimsDistanceSentenceInsideOtherReason() {
            AiPlanDraft draft = draft(List.of(day(1)), List.of(
                reason("REST_SLOT", "카페에서 쉬는 시간을 넣었어요. 장소 사이가 가까워 이동이 짧아요.")));

            AiPlanDraft guarded = guard(1, Map.of()).apply(draft);

            assertThat(guarded.reasons()).singleElement()
                .extracting(AiPlanDraftReason::description).isEqualTo("카페에서 쉬는 시간을 넣었어요.");
        }

        @Test
        @DisplayName("사실만 담은 근거는 글자 하나 바뀌지 않는다")
        void keepsFactualReasonAsIs() {
            String description = "비 소식이 있는 2일차에는 실내 장소를 넣었어요.  미술관은 실내예요.";
            AiPlanDraft draft = draft(List.of(day(1)), List.of(reason("INDOOR_ALTERNATIVE", description)));

            AiPlanDraft guarded = guard(1, Map.of()).apply(draft);

            assertThat(guarded.reasons()).singleElement()
                .extracting(AiPlanDraftReason::description).isEqualTo(description);
        }
    }

    @Nested
    @DisplayName("더위")
    class Heat {

        @Test
        @DisplayName("최고기온 23℃ 여행에서 더위 근거는 빠진다")
        void dropsHeatReasonOnMildTrip() {
            AiPlanDraft draft = draft(List.of(day(1)), List.of(
                reason("WEATHER_OK", "실내 위주라 한낮의 더위를 피할 수 있어요.")));

            AiPlanDraft guarded = guard(1, Map.of(1, 23.0)).apply(draft);

            assertThat(guarded.reasons()).isEmpty();
        }

        @Test
        @DisplayName("31℃ 이상인 날이 있으면 더위 근거가 남는다")
        void keepsHeatReasonOnHotTrip() {
            AiPlanDraft draft = draft(List.of(day(1)), List.of(
                reason("WEATHER_OK", "실내 위주라 한낮의 더위를 피할 수 있어요.")));

            AiPlanDraft guarded = guard(1, Map.of(1, 31.0)).apply(draft);

            assertThat(guarded.reasons()).hasSize(1);
        }

        @Test
        @DisplayName("반려견 성향으로서의 더위는 날씨와 무관하게 남는다 — 입력으로 받은 사실이다")
        void keepsHeatSensitivityTrait() {
            AiPlanDraft draft = draft(List.of(day(1, visit(MUSEUM, "더위에 약한 아이라 실내 위주로 골랐어요."))),
                List.of(reason("INDOOR_ALTERNATIVE", "더위에 민감한 반려견이라 실내 장소를 넣었어요.")));

            AiPlanDraft guarded = guard(1, Map.of(1, 23.0)).apply(draft);

            assertThat(note(guarded, 1)).isEqualTo("더위에 약한 아이라 실내 위주로 골랐어요.");
            assertThat(guarded.reasons()).hasSize(1);
        }

        @Test
        @DisplayName("메모의 더위 문장은 그날 기온으로 가른다 — 전망이 없는 날도 더위를 말할 근거가 없다")
        void heatInNoteFollowsThatDay() {
            AiPlanDraft draft = draft(List.of(
                day(1, visit(MUSEUM, "그림을 봐요. 더위를 피해 실내에서 쉬어요.")),
                day(2, visit(MUSEUM, "그림을 봐요. 더위를 피해 실내에서 쉬어요.")),
                day(3, visit(MUSEUM, "그림을 봐요. 더위를 피해 실내에서 쉬어요."))), List.of());

            AiPlanDraft guarded = guard(3, Map.of(1, 33.0, 2, 24.0)).apply(draft);

            assertThat(note(guarded, 1)).isEqualTo("그림을 봐요. 더위를 피해 실내에서 쉬어요.");
            assertThat(note(guarded, 2)).isEqualTo("그림을 봐요.");
            assertThat(note(guarded, 3)).isEqualTo("그림을 봐요.");
        }
    }

    @Nested
    @DisplayName("메모와 장소 유형")
    class NoteAgainstPlace {

        @Test
        @DisplayName("콘도를 해안 산책 장소로 적은 메모는 서버 문구로 바뀐다")
        void replacesLodgingWalkNote() {
            AiPlanDraft draft = draft(List.of(
                day(1, item(PlanItemType.LODGING, CONDO, "해안가에서 가벼운 산책을 할 수 있는 실외 장소예요.")),
                day(2)), List.of());

            AiPlanDraft guarded = guard(2, Map.of()).apply(draft);

            assertThat(note(guarded, 1)).isEqualTo("반려견과 함께 묵는 숙소예요.");
        }

        @Test
        @DisplayName("실내 장소를 야외로, 실외 장소를 실내로 적은 문장은 빠진다")
        void dropsIndoorOutdoorContradiction() {
            AiPlanDraft draft = draft(List.of(day(1,
                visit(MUSEUM, "야외 공간이라 바람이 시원해요. 전시를 봐요."),
                visit(BEACH, "실내라 비가 와도 괜찮아요."))), List.of());

            AiPlanDraft guarded = guard(1, Map.of()).apply(draft);

            assertThat(guarded.days().get(0).items()).extracting(AiPlanDraftItem::note)
                .containsExactly("전시를 봐요.", "반려견과 함께 들르는 실외 장소예요.");
        }

        @Test
        @DisplayName("음식점을 산책하는 곳으로 적은 문장은 빠진다")
        void dropsWalkNoteOnRestaurant() {
            AiPlanDraft draft = draft(List.of(day(1, item(PlanItemType.MEAL, CAFE, "산책하기 좋은 카페예요."))), List.of());

            AiPlanDraft guarded = guard(1, Map.of()).apply(draft);

            assertThat(note(guarded, 1)).isEqualTo("반려견과 함께 들르는 음식점·카페예요.");
        }

        @Test
        @DisplayName("장소가 없는 항목은 지어 채울 사실이 없어 메모를 비운다")
        void clearsNoteWithoutPlace() {
            AiPlanDraftItem move = AiPlanDraftItem.builder()
                .itemType(PlanItemType.MOVE).title("이동").note("가까운 거리라 금방 가요.").build();
            AiPlanDraft draft = draft(List.of(day(1, move)), List.of());

            AiPlanDraft guarded = guard(1, Map.of()).apply(draft);

            assertThat(guarded.days().get(0).items()).singleElement()
                .satisfies(item -> {
                    assertThat(item.title()).isEqualTo("이동");
                    assertThat(item.note()).isNull();
                });
        }

        @Test
        @DisplayName("대비 · 순서 · 위치를 말하는 문장은 모순이 아니다 — 낱말이 아니라 주장을 본다")
        void keepsContrastOrderAndLocationSentences() {
            AiPlanDraft draft = draft(List.of(day(1,
                visit(MUSEUM, "비가 오면 야외 대신 실내에서 쉬어요."),
                item(PlanItemType.MEAL, CAFE, "바닷가 산책 뒤에 들러요."),
                visit(BEACH, "바다와 가까워 걷기 좋아요."))), List.of());

            AiPlanDraft guarded = guard(1, Map.of()).apply(draft);

            assertThat(guarded.days().get(0).items()).extracting(AiPlanDraftItem::note).containsExactly(
                "비가 오면 야외 대신 실내에서 쉬어요.", "바닷가 산책 뒤에 들러요.", "바다와 가까워 걷기 좋아요.");
        }

        @Test
        @DisplayName("맞는 메모는 그대로 둔다 — 실외 해변의 산책, 실내 미술관의 전시")
        void keepsConsistentNotes() {
            AiPlanDraft draft = draft(List.of(day(1,
                visit(BEACH, "야외 해변이라 리드줄을 짧게 잡아요."),
                visit(MUSEUM, "실내 전시라 비가 와도 괜찮아요."))), List.of());

            AiPlanDraft guarded = guard(1, Map.of()).apply(draft);

            assertThat(guarded.days().get(0).items()).extracting(AiPlanDraftItem::note)
                .containsExactly("야외 해변이라 리드줄을 짧게 잡아요.", "실내 전시라 비가 와도 괜찮아요.");
        }
    }

    private static AiPlanDraftFactGuard guard(int dayCount, Map<Integer, Double> maxTemperatureByDay) {
        return new AiPlanDraftFactGuard(CANDIDATES, dayCount, maxTemperatureByDay);
    }

    private static PlaceCandidate place(long id, String title, String contentTypeName, Boolean indoor) {
        return new PlaceCandidate(id, title, contentTypeName, "제주특별자치도", "동반 가능", null, null, indoor, null, 33.5, 126.5);
    }

    private static AiPlanDraft draft(List<AiPlanDraftDay> days, List<AiPlanDraftReason> reasons) {
        return AiPlanDraft.builder().days(days).reasons(reasons).build();
    }

    private static AiPlanDraftDay day(int day, AiPlanDraftItem... items) {
        return AiPlanDraftDay.builder().day(day).items(List.of(items)).build();
    }

    private static AiPlanDraftItem visit(PlaceCandidate place, String note) {
        return item(PlanItemType.PLACE, place, note);
    }

    private static AiPlanDraftItem lodging(PlaceCandidate place) {
        return item(PlanItemType.LODGING, place, "숙소에서 쉬어요.");
    }

    private static AiPlanDraftItem item(PlanItemType type, PlaceCandidate place, String note) {
        return AiPlanDraftItem.builder().itemType(type).placeId(place.placeId()).title(place.title()).note(note).build();
    }

    private static AiPlanDraftReason reason(String code, String description) {
        return AiPlanDraftReason.builder().code(code).name("근거").description(description).build();
    }

    private static List<PlanItemType> itemTypes(AiPlanDraft draft, int day) {
        return draft.days().get(day - 1).items().stream().map(AiPlanDraftItem::itemType).toList();
    }

    private static String note(AiPlanDraft draft, int day) {
        return draft.days().get(day - 1).items().get(0).note();
    }
}
