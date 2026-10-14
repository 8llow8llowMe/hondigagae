package com.hondigagae.domainlayer.planner.adapter.out.llm;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.planner.application.model.DayWeatherOutlook;
import com.hondigagae.domainlayer.planner.application.model.PackingChecklistQuery;
import com.hondigagae.domainlayer.planner.application.model.PetCondition;
import com.hondigagae.domainlayer.planner.application.model.PlanOutline;
import com.hondigagae.domainlayer.planner.application.model.PlanOutline.PlanOutlineDay;
import com.hondigagae.domainlayer.planner.application.model.PlanOutline.PlanOutlineItem;
import com.hondigagae.domainlayer.planner.domain.model.PackingList.PackingItem;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * 준비물 서버 규칙 (#976). 날씨 품목은 <b>문턱 양쪽</b>을 함께 밟는다 — 한쪽만 보면 "언제나 넣는"
 * 구현이나 "절대 안 넣는" 구현도 통과한다.
 */
class PackingListRulesTest {

    private static final LocalDate START = LocalDate.of(2026, 10, 7);
    private static final List<String> ESSENTIALS = List.of("배변봉투", "휴대용 물그릇", "리드줄", "하네스", "사료와 간식");

    /* 여행 맥락 (#1435). 10월(START)은 계절 품목이 없는 달이라, 기존 테스트와 여행 맥락 테스트가 계절과 섞이지 않는다. */
    private static final LocalDate NOVEMBER = LocalDate.of(2026, 11, 6);
    private static final String JEJU = "39";
    private static final String JEJU_ENTRY = "제주는 비행기나 배로 들어가요. ";
    private static final String BOARDING = "항공사·선사마다 반려견 탑승 조건(이동장 규격·무게·서류)이 달라 예약한 곳의 규정을 미리 확인해요.";
    private static final String SEASONAL_NOTE = " 아직 예보가 없어 계절 기준으로 넣었어요.";

    /*
     * #976 의 dev 실측을 그대로 옮긴 고정 입력이다 (3일, 말티즈 소형견 · 더위 민감, 17~24℃, 강수 10~20%).
     */
    @Test
    @DisplayName("dev 실측 — 없는 품목 · 수치와 안 맞는 날씨 품목이 빠지고 기본 품목이 서버 문장으로 선다")
    void correctsDevPackingList() {
        PackingChecklistQuery query = query(3, List.of(maltese()),
            day(0, 10, 17.0, 23.0), day(1, 20, 18.0, 24.0), day(2, 10, 17.0, 22.0));
        List<PackingItem> model = List.of(
            item("반려견 케어", "방충망 장갑", "해충이 많은 숲길 일정에 대비해요."),
            item("날씨 대비", "소형견용 우산", "강수확률 10%와 20%로 비가 올 가능성이 있어요."),
            item("필수", "휴대용 화장지", "산책 시 배변 처리에 필요해요."),
            item("날씨 대비", "통풍 좋은 가벼운 재킷", "한낮 야외 일정을 피하고 실내나 그늘 위주로 짤 때 체온 조절에 좋아요."),
            item("필수", "휴대용 물병", "더위에 민감한 말티즈라 수분 보충이 필요해요."),
            item("반려견 케어", "물티슈", "해변 일정 뒤 발을 닦아요."));

        List<PackingItem> packed = new PackingListRules(query).apply(model);

        // 이 여행에만 해당하는 품목이 앞이다 — 요약 카드가 앞 5개만 보여 준다.
        assertThat(packed).extracting(PackingItem::name)
            .containsExactly("물티슈", "배변봉투", "휴대용 물그릇", "리드줄", "하네스", "사료와 간식");
        assertThat(find(packed, "휴대용 물그릇").reason()).isEqualTo("이동 중에도 물을 자주 마시게 해요.");
        assertThat(find(packed, "사료와 간식").reason()).startsWith("3일 동안 먹을");
    }

    /*
     * #1435 사용성 테스트(dev)를 옮긴 고정 입력이다 — 11/6~8 제주 2박3일, 웰시코기 12kg, 1일차 첫 장소 비양도, 열흘 뒤라 예보가
     * 없었다. 기본 5개만 나왔던 자리다.
     */
    @Test
    @DisplayName("사용성 테스트 — 계절 옷 · 이동장이 서고, 날씨 → 여행 맥락 → 모델 → 기본 품목 순이다")
    void usabilityTestTripInOrder() {
        PetCondition corgi = PetCondition.builder().breed("웰시코기").sizeName("중형견").weightText("12").build();
        PackingChecklistQuery query = PackingChecklistQuery.builder()
            .startDate("2026-11-06").endDate("2026-11-08").petConditions(List.of(corgi)).weatherOutlook(List.of())
            .planOutline(outline(JEJU, List.of(place("비양도"), place("협재해수욕장")), List.of(place("사려니숲길")), List.of(place("동문재래시장"))))
            .build();

        List<PackingItem> packed = new PackingListRules(query).apply(List.of(
            item("이동 중", "멀미약", "1일차 비양도에 배를 타고 들어가 멀미할 수 있어요.")));

        assertThat(packed).extracting(PackingItem::name)
            .containsExactly("반려견 옷", "이동장", "멀미약", "배변봉투", "휴대용 물그릇", "리드줄", "하네스", "사료와 간식");
        assertThat(find(packed, "반려견 옷").reason()).isEqualTo("11월 여행이라 아침저녁이 쌀쌀할 수 있어요." + SEASONAL_NOTE);
        assertThat(find(packed, "이동장").reason()).isEqualTo("1일차 비양도는 배를 타고 들어가요. " + JEJU_ENTRY + BOARDING);
    }

    @Nested
    @DisplayName("비")
    class Rain {

        @Test
        @DisplayName("강수확률 60% 이상인 날이 있으면 우비를 넣고 그날 수치를 이유로 쓴다")
        void addsRaincoatAtSixtyPercent() {
            List<PackingItem> packed = rules(query(3, List.of(), day(0, 20, 18.0, 24.0), day(1, 70, 18.0, 22.0)));

            assertThat(find(packed, "반려견 우비").reason()).isEqualTo("2일차 강수확률이 70%예요.");
        }

        @Test
        @DisplayName("강수확률 59% 는 비 오는 날이 아니다")
        void noRaincoatBelowThreshold() {
            List<PackingItem> packed = rules(query(2, List.of(), day(0, 59, 18.0, 24.0)));

            assertThat(packed).extracting(PackingItem::name).doesNotContain("반려견 우비");
        }

        @Test
        @DisplayName("확률이 없어도 강수형태가 있으면 비 오는 날이다 — '없음' · '정보 없음' 은 아니다")
        void precipitationTypeAlsoCounts() {
            DayWeatherOutlook shower = DayWeatherOutlook.builder().date(START).precipitationTypeName("소나기").build();
            DayWeatherOutlook none = DayWeatherOutlook.builder().date(START.plusDays(1)).precipitationTypeName("없음").build();
            DayWeatherOutlook unknown = DayWeatherOutlook.builder().date(START).precipitationTypeName("정보 없음").build();

            assertThat(find(rules(query(2, List.of(), shower)), "반려견 우비").reason()).isEqualTo("1일차 소나기 예보가 있어요.");
            assertThat(rules(query(2, List.of(), none))).extracting(PackingItem::name).doesNotContain("반려견 우비");
            assertThat(rules(query(2, List.of(), unknown))).extracting(PackingItem::name).doesNotContain("반려견 우비");
        }
    }

    @Nested
    @DisplayName("더위와 추위")
    class Temperature {

        @Test
        @DisplayName("최고기온 31℃ 부터 쿨매트다. 30℃ 는 아니다")
        void coolingMatAtThirtyOne() {
            assertThat(find(rules(query(1, List.of(), day(0, 0, 25.0, 31.0))), "쿨매트").reason())
                .isEqualTo("1일차 최고기온이 31℃예요.");
            assertThat(rules(query(1, List.of(), day(0, 0, 25.0, 30.0))))
                .extracting(PackingItem::name).doesNotContain("쿨매트");
        }

        @Test
        @DisplayName("더위에 민감한 아이가 있으면 28℃ 부터다. 27.5℃ 는 아니다")
        void heatSensitiveLowersThreshold() {
            assertThat(rules(query(1, List.of(maltese()), day(0, 0, 22.0, 28.0))))
                .extracting(PackingItem::name).contains("쿨매트");
            assertThat(rules(query(1, List.of(maltese()), day(0, 0, 22.0, 27.5))))
                .extracting(PackingItem::name).doesNotContain("쿨매트");
        }

        @Test
        @DisplayName("최저기온 5℃ 부터 옷이다. 5.5℃ 는 아니다")
        void warmClothesAtFive() {
            assertThat(find(rules(query(1, List.of(), day(0, 0, 5.0, 11.0))), "반려견 옷").reason())
                .isEqualTo("1일차 최저기온이 5℃예요.");
            assertThat(rules(query(1, List.of(), day(0, 0, 5.5, 11.0))))
                .extracting(PackingItem::name).doesNotContain("반려견 옷");
        }

        @Test
        @DisplayName("추위에 민감한 아이가 있으면 10℃ 부터다. 10.5℃ 는 아니다")
        void coldSensitiveLowersThreshold() {
            PetCondition coldSensitive = PetCondition.builder().breed("치와와").coldSensitive(true).build();

            assertThat(rules(query(1, List.of(coldSensitive), day(0, 0, 10.0, 16.0))))
                .extracting(PackingItem::name).contains("반려견 옷");
            assertThat(rules(query(1, List.of(coldSensitive), day(0, 0, 10.5, 16.0))))
                .extracting(PackingItem::name).doesNotContain("반려견 옷");
        }

        @Test
        @DisplayName("여러 마리면 한 마리라도 민감할 때 문턱이 낮아진다 — 다견 합집합과 같은 방향")
        void anySensitivePetLowersThreshold() {
            PetCondition calm = PetCondition.builder().breed("리트리버").build();

            assertThat(rules(query(1, List.of(calm, maltese()), day(0, 0, 22.0, 29.0))))
                .extracting(PackingItem::name).contains("쿨매트");
            assertThat(rules(query(1, List.of(calm), day(0, 0, 22.0, 29.0))))
                .extracting(PackingItem::name).doesNotContain("쿨매트");
        }

        @Test
        @DisplayName("전망이 없고 계절 품목이 없는 달(10월)이면 날씨 품목을 넣지 않는다 — 모르는 날씨를 지어내지 않는다")
        void noWeatherNoWeatherGear() {
            assertThat(rules(query(2, List.of(maltese())))).extracting(PackingItem::name).containsExactlyElementsOf(ESSENTIALS);
        }
    }

    @Nested
    @DisplayName("모델이 더한 품목")
    class ModelExtras {

        @Test
        @DisplayName("기본 품목과 같은 종류는 서버 문장 하나만 남는다")
        void essentialDuplicatesCollapse() {
            List<PackingItem> packed = new PackingListRules(query(1, List.of())).apply(List.of(
                item("필수", "배변 봉투", "배변을 치워요."), item("필수", "접이식 물그릇", "물을 마셔요."),
                item("필수", "목줄", "필수예요."), item("필수", "평소 먹던 사료", "먹던 것이 좋아요.")));

            assertThat(packed).extracting(PackingItem::name).containsExactlyElementsOf(ESSENTIALS);
        }

        @Test
        @DisplayName("이유의 날씨 문장이 예보와 어긋나면 그 문장만 걷고, 남는 이유가 없으면 품목을 버린다")
        void trimsWeatherSentencesInExtraReasons() {
            PackingChecklistQuery mild = query(2, List.of(), day(0, 10, 17.0, 23.0));
            List<PackingItem> packed = new PackingListRules(mild).apply(List.of(
                item("반려견 케어", "수건", "비가 올 수 있어요. 해변에서 젖은 몸을 닦아요."),
                item("반려견 케어", "담요", "더위에 지친 아이를 쉬게 해요.")));

            assertThat(packed).extracting(PackingItem::name).contains("수건").doesNotContain("담요");
            assertThat(find(packed, "수건").reason()).isEqualTo("해변에서 젖은 몸을 닦아요.");
        }

        @Test
        @DisplayName("비 오는 여행이면 비 문장이 남는다")
        void keepsRainSentenceWhenRainy() {
            PackingChecklistQuery rainy = query(2, List.of(), day(0, 80, 17.0, 23.0));
            List<PackingItem> packed = new PackingListRules(rainy).apply(List.of(
                item("반려견 케어", "수건", "비가 올 수 있어요. 해변에서 젖은 몸을 닦아요.")));

            assertThat(find(packed, "수건").reason()).isEqualTo("비가 올 수 있어요. 해변에서 젖은 몸을 닦아요.");
        }

        @Test
        @DisplayName("\"준비가\" · \"비 예보는 없지만\" 은 비 문장이 아니다 — 서술로 잡는다")
        void rainClaimIsAPredicateNotASyllable() {
            PackingChecklistQuery mild = query(2, List.of(), day(0, 10, 17.0, 23.0));
            List<PackingItem> packed = new PackingListRules(mild).apply(List.of(
                item("이동 중", "이동장", "1일차 협재해수욕장까지 장거리 차량 이동 준비가 필요해요."),
                item("반려견 케어", "물티슈", "비 예보는 없지만 해변 뒤 발을 닦아요.")));

            assertThat(find(packed, "이동장").reason()).isEqualTo("1일차 협재해수욕장까지 장거리 차량 이동 준비가 필요해요.");
            assertThat(find(packed, "물티슈").reason()).isEqualTo("비 예보는 없지만 해변 뒤 발을 닦아요.");
        }

        @Test
        @DisplayName("구명조끼 · 방수 배변패드는 옷 · 우비가 아니다 — 서버 종류 낱말에 걸려도 받는다")
        void safetyAndPadsAreNotWeatherGear() {
            List<PackingItem> packed = new PackingListRules(query(1, List.of())).apply(List.of(
                item("반려견 케어", "반려견 구명조끼", "1일차 협재해수욕장에서 카약을 타요."),
                item("반려견 케어", "라이프 재킷", "1일차 협재해수욕장에서 패들보드를 타요."),
                item("이동 중", "방수 배변패드", "1일차 이동하는 차 안에서 깔아요.")));

            assertThat(packed).extracting(PackingItem::name).contains("반려견 구명조끼", "라이프 재킷", "방수 배변패드");
        }

        @Test
        @DisplayName("분류가 비어도 실패하지 않고 반려견 케어로 접는다")
        void nullCategoryFolds() {
            List<PackingItem> packed = new PackingListRules(query(1, List.of())).apply(List.of(
                item(null, "물티슈", "해변 뒤 발을 닦아요.")));

            assertThat(find(packed, "물티슈").category()).isEqualTo(PackingListRules.CATEGORY_CARE);
        }

        @Test
        @DisplayName("이유가 없는 품목은 버린다 — 이 여행의 무엇 때문인지 말하지 못한다 (#1336)")
        void dropsExtraWithoutReason() {
            List<PackingItem> packed = new PackingListRules(query(1, List.of())).apply(List.of(
                item("반려견 케어", "물티슈", null), item("반려견 케어", "인식표", " ")));

            assertThat(packed).extracting(PackingItem::name).containsExactlyElementsOf(ESSENTIALS);
        }

        @Test
        @DisplayName("사람용 캐리어는 목록 밖이다. 펫 캐리어는 받는다")
        void humanLuggageIsNotAnExtra() {
            List<PackingItem> packed = new PackingListRules(query(1, List.of())).apply(List.of(
                item("이동 중", "기내용 캐리어", "짐을 담아요."), item("이동 중", "펫 캐리어", "1일차 비행기에 탑승해요.")));

            assertThat(packed).extracting(PackingItem::name).contains("펫 캐리어").doesNotContain("기내용 캐리어");
        }

        @Test
        @DisplayName("모르는 분류는 반려견 케어로 접는다 — 화면이 분류로 묶는다")
        void unknownCategoryFolds() {
            List<PackingItem> packed = new PackingListRules(query(1, List.of())).apply(List.of(
                item("기타", "진드기 기피제", "숲길 일정이 있어요.")));

            assertThat(find(packed, "진드기 기피제").category()).isEqualTo(PackingListRules.CATEGORY_CARE);
        }
    }

    @Nested
    @DisplayName("이유의 근거와 쓰임 (#1336)")
    class Grounding {

        /*
         * prod 실측(2026-10-10)을 옮긴 고정 입력이다. 담요 · 이동장은 일차와 장소를 가리키지만 물건과 이어지지
         * 않고, 물티슈는 1일차 강수 60% 에서 물건의 쓰임으로 이어진다.
         */
        @Test
        @DisplayName("prod 실측 — 사실을 가리켜도 물건과 이어지지 않는 담요 · 이동장은 버리고 물티슈는 남긴다")
        void dropsReasonsThatDoNotConnectToTheItem() {
            PackingChecklistQuery query = query(2, List.of(maltese()),
                plan(List.of("곽지해수욕장"), List.of("중문색달해수욕장", "선녀와나무꾼")),
                day(0, 60, 17.0, 23.0), day(1, 20, 18.0, 24.0));
            List<PackingItem> packed = new PackingListRules(query).apply(List.of(
                item("반려견 케어", "휴대용 담요", "2일차 중문색달해수욕장과 선녀와나무꾼에서 그늘이 필요하므로 담요가 필요해요."),
                item("이동 중", "해변용 이동장", "곽지해수욕장과 중문색달해수욕장에서 물에 젖을 수 있으니 이동장이 필요해요."),
                item("반려견 케어", "물티슈", "1일차 강수확률 60%라 젖은 발을 닦아 줘요.")));

            assertThat(packed).extracting(PackingItem::name)
                .contains("반려견 우비", "물티슈").doesNotContain("휴대용 담요", "해변용 이동장");
        }

        /*
         * dev 실측(2026-10-11, 데모 일정 3일 · 말티즈 소형견, 개정 전 프롬프트로 세 번 생성)의 모델 품목 전부다.
         * 새 검사가 좋은 이유까지 버리지 않는지 보는 대조군이다 — 근거 없는 인식표 한 줄만 빠져야 한다.
         * 같은 이름은 목록에서 하나로 접히므로 셋째 생성의 이동장은 켄넬로 이름만 바꿔 넣었다.
         */
        @Test
        @DisplayName("dev 실측 — 근거와 쓰임이 있는 이유는 남고 근거 없는 한 줄만 빠진다")
        void keepsGroundedDevOutputs() {
            PackingChecklistQuery demo = query(3, List.of(maltese()), plan(
                List.of("곽지해수욕장", "당당", "어반컨트리"),
                List.of("중문색달해수욕장", "애견카페왈 사계점", "다와풀빌라펜션"),
                List.of("제주마방목지", "벙커하우스")));
            List<PackingItem> model = List.of(
                item("반려견 케어", "휴대용 물티슈", "1일차 곽지해수욕장과 2일차 중문색달해수욕장에서 모래와 물때를 청소해야 해요"),
                item("반려견 케어", "휴대용 담요", "3일차 제주마방목지와 벙커하우스에서 야외 활동 시 바닥이 차가울 수 있어 따뜻하게 해줘야 해요"),
                item("이동 중", "휴대용 이동장", "2일차 애견카페왈 사계점에서 실내에서도 편안하게 앉을 수 있도록 필요해요"),
                item("반려견 케어", "물티슈", "1일차 곽지해수욕장에서 모래를 닦아야 해요"),
                item("이동 중", "이동장", "2일차 애견카페왈 사계점에서 카페 내부에서 산책을 할 때 필요해요"),
                item("반려견 케어", "담요", "3일차 벙커하우스에서 실내에 편안히 쉴 수 있게 해줘요"),
                item("반려견 케어", "진드기 기피제", "2일차 제주마방목지에서 풀밭을 걸을 때 필요해요"),
                item("반려견 케어", "인식표", "모든 일정에서 안전을 위해 필요해요"),
                item("이동 중", "켄넬", "1~3일차에 여러 장소를 방문하므로 이동 중 편안함을 위해 켄넬이 필요해요"),
                item("반려견 케어", "인식표", "1~3일차에 도보 및 해변 활동이 포함돼 있어 반려견의 안전을 위해 인식표가 필요해요"));

            List<PackingItem> packed = new PackingListRules(demo).apply(model);

            assertThat(packed).extracting(PackingItem::name).contains(
                "휴대용 물티슈", "휴대용 담요", "휴대용 이동장", "물티슈", "이동장", "담요", "진드기 기피제", "켄넬");
            assertThat(packed).filteredOn(item -> item.name().equals("인식표")).extracting(PackingItem::reason)
                .containsExactly("1~3일차에 도보 및 해변 활동이 포함돼 있어 반려견의 안전을 위해 인식표가 필요해요");
        }

        @Test
        @DisplayName("쓰임과 이어지면 같은 물건도 남는다 — 종류 낱말 자체는 쓰임으로 읽지 않는다")
        void keepsItemsWhoseReasonNamesTheUse() {
            List<PackingItem> packed = new PackingListRules(query(2, List.of())).apply(List.of(
                item("반려견 케어", "휴대용 담요", "2일차 사려니숲길 다녀와 차 안에 깔아 익숙한 냄새로 쉬게 해요."),
                item("이동 중", "이동장", "1일차 카페 델문도는 이동장에 넣어야 들어갈 수 있어요.")));

            assertThat(packed).extracting(PackingItem::name).contains("휴대용 담요", "이동장");
        }

        @Test
        @DisplayName("일정 · 예보 · 반려견 특성 중 아무것도 가리키지 않는 이유는 버린다")
        void dropsReasonsWithoutTripFacts() {
            List<PackingItem> packed = new PackingListRules(query(2, List.of(maltese()))).apply(List.of(
                item("반려견 케어", "인식표", "있으면 편해요."),
                item("반려견 케어", "물티슈", "발을 닦아 줘요.")));

            assertThat(packed).extracting(PackingItem::name).containsExactlyElementsOf(ESSENTIALS);
        }

        @Test
        @DisplayName("여행 기간 밖의 일차 · 일정에 없는 장소 종류 · 예보 없는 수치는 사실이 아니다")
        void factsMustExistInThisTrip() {
            PackingChecklistQuery forestOnly = query(2, List.of(), plan(List.of("사려니숲길")));
            List<PackingItem> packed = new PackingListRules(forestOnly).apply(List.of(
                item("반려견 케어", "물티슈", "5일차 산책 뒤 발을 닦아요."),
                item("반려견 케어", "수건", "해변에서 젖은 몸을 닦아요."),
                item("반려견 케어", "인식표", "최대풍속 9m/s라 잃어버리기 쉬워요.")));

            assertThat(packed).extracting(PackingItem::name).containsExactlyElementsOf(ESSENTIALS);
        }

        @Test
        @DisplayName("장소 이름 · 장소 종류 · 반려견 특성은 사실이다")
        void placesAndPetTraitsAreFacts() {
            List<PackingItem> packed = new PackingListRules(query(2, List.of(maltese()))).apply(List.of(
                item("반려견 케어", "진드기 기피제", "사려니 숲길 풀숲을 걸어요."),
                item("반려견 케어", "수건", "해변에서 젖은 몸을 닦아요."),
                item("반려견 케어", "빗", "말티즈는 털이 잘 엉켜요.")));

            assertThat(packed).extracting(PackingItem::name).contains("진드기 기피제", "수건", "빗");
        }

        /* 리뷰에서 잡은 오탐 — 한 글자 쓰임 낱말이 활용형에 걸려 prod 와 같은 따로 노는 이유를 통과시켰다. */
        @Test
        @DisplayName("쓰임 낱말은 활용형에 걸리지 않는다 — 쉬우니 · 잠시 · 볼거리 · 비행기 · 아침 · 출발")
        void purposeWordsDoNotMatchInsideOtherWords() {
            List<PackingItem> packed = new PackingListRules(query(2, List.of())).apply(List.of(
                item("이동 중", "해변용 이동장", "협재해수욕장에서 털이 젖기 쉬우니 이동장이 필요해요."),
                item("반려견 케어", "휴대용 담요", "2일차 사려니숲길에서 잠시 그늘이 필요하므로 담요가 필요해요."),
                item("이동 중", "이동장", "1일차 협재해수욕장 주변 볼거리가 많아 이동장이 필요해요."),
                item("반려견 케어", "담요", "2일차 이동이 많아 그늘이 필요해 담요가 필요해요."),
                item("반려견 케어", "수건", "1일차 비행기 타기 전 챙겨요."),
                item("반려견 케어", "물티슈", "1일차 아침 일찍 출발해요.")));

            assertThat(packed).extracting(PackingItem::name).containsExactlyElementsOf(ESSENTIALS);
        }

        @Test
        @DisplayName("이동 항목 제목 · 흔한 장소 토막(반려견 · 놀이터)은 장소 사실이 아니다")
        void moveTitlesAndCommonTokensAreNotPlaces() {
            PlanOutline plan = PlanOutline.builder().planId(1L).days(List.of(PlanOutlineDay.builder().day(1).items(List.of(
                PlanOutlineItem.builder().title("이동").itemType("MOVE").build(),
                PlanOutlineItem.builder().title("제주 반려견 놀이터").itemType("PLACE").placeId(1L).build())).build())).build();
            List<PackingItem> packed = new PackingListRules(query(2, List.of(), plan)).apply(List.of(
                item("반려견 케어", "휴대용 담요", "이동 중에 담요가 필요해요."),
                item("반려견 케어", "인식표", "반려견을 잃어버리지 않게 해요."),
                item("반려견 케어", "장난감", "제주 반려견 놀이터에서 놀아요.")));

            assertThat(packed).extracting(PackingItem::name).contains("장난감").doesNotContain("휴대용 담요", "인식표");
        }

        @Test
        @DisplayName("일정에 없는 장소 종류를 말하면 일차가 있어도 버린다 — 개요가 없으면 판정하지 않는다")
        void absentPlaceKindDropsEvenWithDay() {
            List<PackingItem> forest = new PackingListRules(query(2, List.of(), plan(List.of("사려니숲길")))).apply(List.of(
                item("반려견 케어", "물티슈", "2일차 협재해수욕장에서 모래를 닦아요.")));
            List<PackingItem> unknown = new PackingListRules(query(2, List.of(), (PlanOutline) null)).apply(List.of(
                item("반려견 케어", "물티슈", "1일차 해변에서 모래를 닦아요.")));

            assertThat(forest).extracting(PackingItem::name).doesNotContain("물티슈");
            assertThat(unknown).extracting(PackingItem::name).contains("물티슈");
        }

        @Test
        @DisplayName("일차 범위는 끝까지 여행 기간 안이어야 한다")
        void dayRangeEndMustBeInTrip() {
            List<PackingItem> packed = new PackingListRules(query(2, List.of())).apply(List.of(
                item("이동 중", "이동장", "1~9일차 차로 옮겨 다녀요."), item("이동 중", "켄넬", "1~2일차 차로 옮겨 다녀요.")));

            assertThat(packed).extracting(PackingItem::name).contains("켄넬").doesNotContain("이동장");
        }

        @Test
        @DisplayName("반려견 특성은 켜진 것만 사실이다 — 소리 민감 · 체중 · 여러 마리의 반려견 N")
        void onlyPresentPetTraitsAreFacts() {
            PetCondition calm = PetCondition.builder().breed("푸들").build();
            PetCondition noisy = PetCondition.builder().breed("푸들").noiseSensitive(true).weightText("3.2").build();
            List<PackingItem> item = List.of(
                item("반려견 케어", "인식표", "소리에 놀라 달아날 수 있어요."),
                item("반려견 케어", "장난감", "체중이 가벼워 금방 지쳐요."));

            assertThat(new PackingListRules(query(2, List.of(calm))).apply(item))
                .extracting(PackingItem::name).doesNotContain("인식표", "장난감");
            assertThat(new PackingListRules(query(2, List.of(noisy))).apply(item))
                .extracting(PackingItem::name).contains("인식표", "장난감");
            assertThat(new PackingListRules(query(2, List.of(calm, calm))).apply(List.of(
                item("반려견 케어", "인식표", "반려견 2는 겁이 많아 달아날 수 있어요."))))
                .extracting(PackingItem::name).contains("인식표");
        }

        @Test
        @DisplayName("예보라는 낱말만으로는 사실이 아니다")
        void forecastWordAloneIsNotAFact() {
            List<PackingItem> packed = new PackingListRules(query(2, List.of(), day(0, 10, 17.0, 23.0))).apply(List.of(
                item("반려견 케어", "인식표", "날씨 예보를 미리 확인해요.")));

            assertThat(packed).extracting(PackingItem::name).doesNotContain("인식표");
        }
    }

    @Nested
    @DisplayName("예보가 없으면 계절 품목 (#1435)")
    class Season {

        @Test
        @DisplayName("11 · 3월은 반려견 옷이다 — 아침저녁이 쌀쌀할 수 있다고 쓴다")
        void chillyMonthsAddClothes() {
            PackingItem november = find(rules(seasonQuery(NOVEMBER, 3)), "반려견 옷");

            assertThat(november.category()).isEqualTo(PackingListRules.CATEGORY_WEATHER);
            assertThat(november.reason()).isEqualTo("11월 여행이라 아침저녁이 쌀쌀할 수 있어요." + SEASONAL_NOTE);
            assertThat(find(rules(seasonQuery(LocalDate.of(2027, 3, 20), 2)), "반려견 옷").reason())
                .isEqualTo("3월 여행이라 아침저녁이 쌀쌀할 수 있어요." + SEASONAL_NOTE);
        }

        @Test
        @DisplayName("12~2월은 반려견 옷이다 — 기온이 낮다고 쓴다")
        void coldMonthsAddClothes() {
            assertThat(find(rules(seasonQuery(LocalDate.of(2027, 1, 8), 2)), "반려견 옷").reason())
                .isEqualTo("1월 여행이라 기온이 낮아요." + SEASONAL_NOTE);
        }

        @Test
        @DisplayName("7 · 8월은 쿨매트다")
        void hotMonthsAddCoolingMat() {
            List<PackingItem> packed = rules(seasonQuery(LocalDate.of(2026, 8, 10), 3));

            assertThat(find(packed, "쿨매트").reason()).isEqualTo("8월 여행이라 한낮 더위가 심할 수 있어요." + SEASONAL_NOTE);
            assertThat(packed).extracting(PackingItem::name).doesNotContain("반려견 옷");
        }

        @Test
        @DisplayName("4 · 5 · 6 · 9 · 10월은 계절만으로 부를 품목이 없다")
        void mildMonthsAddNothing() {
            assertThat(rules(seasonQuery(LocalDate.of(2026, 5, 12), 3))).extracting(PackingItem::name).containsExactlyElementsOf(ESSENTIALS);
        }

        @Test
        @DisplayName("여행 안 날짜에 예보가 하나라도 있으면 수치 규칙만 쓴다 — 계절 품목이 없다")
        void forecastWithinTripWins() {
            // 3일 중 마지막 날 하루만 예보가 있다. 그날 최저 12℃ 는 옷 문턱(5℃)에 못 미친다.
            List<PackingItem> packed = rules(seasonQuery(NOVEMBER, 3, on(NOVEMBER.plusDays(2), 12.0, 17.0)));

            assertThat(packed).extracting(PackingItem::name).containsExactlyElementsOf(ESSENTIALS);
        }

        @Test
        @DisplayName("예보가 여행 밖 날짜에만 있으면 없는 것과 같다 — 계절 품목이 선다")
        void forecastOutsideTripDoesNotCount() {
            List<PackingItem> packed = rules(seasonQuery(NOVEMBER, 3, on(NOVEMBER.minusDays(1), 12.0, 17.0), on(NOVEMBER.plusDays(3), 12.0, 17.0)));

            assertThat(find(packed, "반려견 옷").reason()).isEqualTo("11월 여행이라 아침저녁이 쌀쌀할 수 있어요." + SEASONAL_NOTE);
        }

        @Test
        @DisplayName("달을 걸치면 추운 쪽이 먼저다 — 2/27~3/2 는 2월 기준 '기온이 낮아요'")
        void spanningMonthsPicksTheColdRule() {
            assertThat(find(rules(seasonQuery(LocalDate.of(2027, 2, 27), 4)), "반려견 옷").reason())
                .isEqualTo("2월 여행이라 기온이 낮아요." + SEASONAL_NOTE);
        }

        @Test
        @DisplayName("여행 시작일을 모르면 계절을 판정하지 않는다")
        void unknownStartDateSkipsSeason() {
            PackingChecklistQuery unknown = PackingChecklistQuery.builder()
                .endDate("2026-11-08").petConditions(List.of()).weatherOutlook(List.of()).planOutline(plan(List.of("협재해수욕장")))
                .build();

            assertThat(rules(unknown)).extracting(PackingItem::name).containsExactlyElementsOf(ESSENTIALS);
        }

        @Test
        @DisplayName("계절 품목도 날씨 품목이다 — 모델이 적은 옷 종류는 버린다")
        void seasonalItemReplacesModelGear() {
            List<PackingItem> packed = new PackingListRules(seasonQuery(NOVEMBER, 3)).apply(List.of(
                item("날씨 대비", "방한 패딩", "11월이라 쌀쌀해요.")));

            assertThat(packed).extracting(PackingItem::name).contains("반려견 옷").doesNotContain("방한 패딩");
        }

        @Test
        @DisplayName("연말연초를 걸치면 12월 기준이다 — 12/30~1/2")
        void newYearTripUsesDecember() {
            assertThat(find(rules(seasonQuery(LocalDate.of(2026, 12, 30), 4)), "반려견 옷").reason())
                .isEqualTo("12월 여행이라 기온이 낮아요." + SEASONAL_NOTE);
        }
    }

    @Nested
    @DisplayName("여행 맥락 품목 — 이동장 (#1435)")
    class TripContext {

        @Test
        @DisplayName("제주 여행이면 섬이 없어도 이동장을 넣고 입도와 탑승 조건 확인을 적는다")
        void jejuTripAddsCarrier() {
            PackingItem carrier = find(rules(contextQuery(outline(JEJU, List.of(place("협재해수욕장"))))), "이동장");

            assertThat(carrier.category()).isEqualTo(PackingListRules.CATEGORY_MOVING);
            assertThat(carrier.reason()).isEqualTo(JEJU_ENTRY + BOARDING);
        }

        @Test
        @DisplayName("1일차 비양도(장소)는 배를 타고 들어간다고 이유 앞에 적는다")
        void islandPlaceLeadsTheReason() {
            PlanOutline plan = outline(JEJU, List.of(place("비양도"), place("협재해수욕장")), List.of(place("사려니숲길")));

            assertThat(find(rules(contextQuery(plan)), "이동장").reason())
                .isEqualTo("1일차 비양도는 배를 타고 들어가요. " + JEJU_ENTRY + BOARDING);
        }

        @Test
        @DisplayName("섬은 장소 · 산책 항목만 본다 — 식당 '마라도횟집' · 숙소 · 이동 제목은 섬이 아니다")
        void onlyPlaceAndWalkTitlesAreIslands() {
            PlanOutline plan = outline(JEJU, List.of(meal("마라도횟집"), lodging("우도 펜션"), move("차귀도 포구로 이동")));

            assertThat(find(rules(contextQuery(plan)), "이동장").reason()).isEqualTo(JEJU_ENTRY + BOARDING);
        }

        /* dev place 표(2026-10-14) 실측 — 섬 이름이 든 본섬 주소 14곳 중 배를 타지 않는 것은 성산 출발 우도잠수함 하나였다. */
        @Test
        @DisplayName("본섬에서 출발하는 우도잠수함은 섬이 아니다 — 유람선은 실제로 배를 타므로 섬이다")
        void mainlandSubmarineIsNotAnIsland() {
            PlanOutline submarine = outline(JEJU, List.of(place("우도잠수함"), place("협재해수욕장")));
            PlanOutline cruise = outline(JEJU, List.of(place("차귀도유람선")));

            assertThat(find(rules(contextQuery(submarine)), "이동장").reason()).isEqualTo(JEJU_ENTRY + BOARDING);
            assertThat(find(rules(contextQuery(cruise)), "이동장").reason())
                .isEqualTo("1일차 차귀도는 배를 타고 들어가요. " + JEJU_ENTRY + BOARDING);
        }

        @Test
        @DisplayName("7 · 8월 제주 여행은 계절 쿨매트 → 이동장 → 기본 품목 순이다")
        void summerJejuTripInOrder() {
            PackingChecklistQuery august = PackingChecklistQuery.builder()
                .startDate("2026-08-10").endDate("2026-08-12").petConditions(List.of()).weatherOutlook(List.of())
                .planOutline(outline(JEJU, List.of(place("협재해수욕장"))))
                .build();

            assertThat(rules(august)).extracting(PackingItem::name)
                .containsExactly("쿨매트", "이동장", "배변봉투", "휴대용 물그릇", "리드줄", "하네스", "사료와 간식");
        }

        @Test
        @DisplayName("섬이 여럿이면 일차 순으로 잇고 같은 섬은 처음 가는 날만 적는다 — 산책 코스도 본다")
        void multipleIslandsInDayOrder() {
            PlanOutline plan = outline(JEJU,
                List.of(place("비양도")), List.of(place("협재해수욕장")), List.of(walk("우도 올레 1-1코스"), place("비양도 등대")));

            assertThat(find(rules(contextQuery(plan)), "이동장").reason())
                .isEqualTo("1일차 비양도 · 3일차 우도는 배를 타고 들어가요. " + JEJU_ENTRY + BOARDING);
        }

        @Test
        @DisplayName("제주 지역코드가 없어도 섬이 있으면 넣는다. 제주도 섬도 아니면 넣지 않는다")
        void carrierNeedsJejuOrIsland() {
            assertThat(find(rules(contextQuery(outline(null, List.of(place("가파도 청보리밭"))))), "이동장").reason())
                .isEqualTo("1일차 가파도는 배를 타고 들어가요. " + BOARDING);
            assertThat(rules(contextQuery(outline("6", List.of(place("해운대해수욕장"))))))
                .extracting(PackingItem::name).doesNotContain("이동장");
        }

        /* 제주도 섬도 아닌 여행의 모델 이동장 · 켄넬은 그대로 검사한다 — 위 Grounding 의 dev 실측 대조군(켄넬)이 그 경우다. */
        @Test
        @DisplayName("서버가 이동장을 넣으면 모델의 이동장 · 켄넬 · 펫 캐리어는 버린다 — 슬링백은 다른 물건이라 그대로 검사한다")
        void serverCarrierReplacesModelCarriers() {
            PackingChecklistQuery jeju = contextQuery(outline(JEJU, List.of(place("비양도")), List.of(place("사려니숲길"))));

            List<PackingItem> packed = new PackingListRules(jeju).apply(List.of(
                item("이동 중", "켄넬", "1일차 비양도 배편에 태워요."),
                item("이동 중", "펫 캐리어", "1일차 비행기 기내에 태워요."),
                item("이동 중", "휴대용 이동장", "2일차 사려니숲길까지 차로 옮겨요."),
                item("이동 중", "슬링백", "2일차 사려니숲길에서 지치면 안아서 옮겨요."),
                item("이동 중", "접이식 슬링백", "있으면 편해요.")));

            assertThat(packed).extracting(PackingItem::name)
                .contains("이동장", "슬링백").doesNotContain("켄넬", "펫 캐리어", "휴대용 이동장", "접이식 슬링백");
            assertThat(packed).filteredOn(item -> item.name().equals("이동장")).extracting(PackingItem::reason)
                .containsExactly("1일차 비양도는 배를 타고 들어가요. " + JEJU_ENTRY + BOARDING);
        }

        @Test
        @DisplayName("섬 이름은 모두 '도' 로 끝난다 — 이유 문장이 조사 '는' 을 붙인다")
        void islandNamesTakeNeun() {
            assertThat(PackingTripContext.ISLANDS).allMatch(island -> island.endsWith("도"));
        }
    }

    @Nested
    @DisplayName("여행 맥락도 이유의 사실이다 (#1435)")
    class TripContextGrounding {

        @Test
        @DisplayName("여행의 달은 사실이다 — '11월이라 바람이 차서 담요로 보온해요'")
        void tripMonthIsAFact() {
            List<PackingItem> packed = new PackingListRules(seasonQuery(NOVEMBER, 3)).apply(List.of(
                item("반려견 케어", "담요", "11월이라 바람이 차서 담요로 보온해요.")));

            assertThat(find(packed, "담요").reason()).isEqualTo("11월이라 바람이 차서 담요로 보온해요.");
        }

        @Test
        @DisplayName("계절 품목이 들어가면 모델 이유의 추위 문장도 남는다 — 예보가 받쳐 주지 않으면 걷힌다")
        void seasonalItemKeepsColdSentences() {
            List<PackingItem> model = List.of(item("반려견 케어", "담요", "11월이라 아침저녁이 쌀쌀해요. 차 안에 깔아 체온을 지켜요."));

            assertThat(find(new PackingListRules(seasonQuery(NOVEMBER, 3)).apply(model), "담요").reason())
                .isEqualTo("11월이라 아침저녁이 쌀쌀해요. 차 안에 깔아 체온을 지켜요.");
            // 예보가 있으면 계절 품목이 없고 최저 12℃ 는 추위가 아니다. 추위 문장을 걷으면 남는 문장은 아무 사실도 가리키지 않는다.
            assertThat(new PackingListRules(seasonQuery(NOVEMBER, 3, on(NOVEMBER, 12.0, 17.0))).apply(model))
                .extracting(PackingItem::name).doesNotContain("담요");
        }

        @Test
        @DisplayName("여행과 다른 계절 · 달을 말하면 다른 사실이 있어도 버린다 — 11월 여행의 '여름' · '7월'. 날짜를 모르면 판정하지 않는다")
        void otherSeasonDrops() {
            List<PackingItem> model = List.of(
                item("반려견 케어", "물티슈", "1일차 협재해수욕장 모래가 여름처럼 달궈져 발을 닦아요."),
                item("반려견 케어", "선크림", "7월처럼 1일차 협재해수욕장 햇볕이 강해 코를 지켜요."),
                item("반려견 케어", "수건", "1일차 협재해수욕장 초겨울 바닷바람에 젖은 몸을 닦아요."));

            assertThat(new PackingListRules(seasonQuery(NOVEMBER, 3)).apply(model)).extracting(PackingItem::name)
                .contains("수건").doesNotContain("물티슈", "선크림");
            PackingChecklistQuery unknown = PackingChecklistQuery.builder()
                .endDate("2026-11-08").petConditions(List.of()).weatherOutlook(List.of()).planOutline(plan(List.of("협재해수욕장")))
                .build();
            assertThat(new PackingListRules(unknown).apply(model)).extracting(PackingItem::name).contains("물티슈", "선크림", "수건");
        }

        @Test
        @DisplayName("달 · 계절 낱말은 경계를 본다 — 1월 여행의 '11월' 은 1월이 아니고, '돌봄' 은 봄이 아니다")
        void monthAndSeasonWordBoundaries() {
            List<PackingItem> january = new PackingListRules(seasonQuery(LocalDate.of(2027, 1, 8), 2)).apply(List.of(
                item("반려견 케어", "담요", "11월에 쓰던 담요를 차 안에 깔아요."),
                item("반려견 케어", "방석", "1월이라 차 안에 깔아 체온을 지켜요.")));
            List<PackingItem> november = new PackingListRules(seasonQuery(NOVEMBER, 3)).apply(List.of(
                item("반려견 케어", "물티슈", "1일차 협재해수욕장 뒤 발 돌봄에 써요.")));

            assertThat(january).extracting(PackingItem::name).contains("방석").doesNotContain("담요");
            assertThat(november).extracting(PackingItem::name).contains("물티슈");
        }

        @Test
        @DisplayName("달 범위를 읽는다 — 1월 여행의 '12~2월' · '12월~2월' 은 여행의 달이다. 7월 여행이면 다른 계절이다")
        void monthRangesAreRead() {
            List<PackingItem> model = List.of(
                item("반려견 케어", "담요", "12~2월은 바람이 차서 차 안에 깔아 보온해요."),
                item("반려견 케어", "방석", "12월~2월은 바닥이 차서 깔아 줘요."));

            assertThat(new PackingListRules(seasonQuery(LocalDate.of(2027, 1, 8), 2)).apply(model))
                .extracting(PackingItem::name).contains("담요", "방석");
            assertThat(new PackingListRules(seasonQuery(LocalDate.of(2026, 7, 20), 2)).apply(model))
                .extracting(PackingItem::name).doesNotContain("담요", "방석");
        }

        @Test
        @DisplayName("계절 낱말은 앞뒤 한 달까지 여행의 계절이다 — 9월 초의 '여름' · 3월의 '겨울' · 2월의 '늦겨울'. 11월의 '여름' · '한겨울' 은 아니다")
        void seasonWordsReachNeighborMonths() {
            assertThat(new PackingListRules(seasonQuery(LocalDate.of(2026, 9, 2), 3)).apply(List.of(
                item("반려견 케어", "물티슈", "여름 끝자락이라 1일차 협재해수욕장 모래가 달궈져 발을 닦아요."))))
                .extracting(PackingItem::name).contains("물티슈");
            assertThat(new PackingListRules(seasonQuery(LocalDate.of(2027, 3, 20), 2)).apply(List.of(
                item("반려견 케어", "방석", "겨울 바람이 남아 차 안에 깔아 보온해요."))))
                .extracting(PackingItem::name).contains("방석");
            assertThat(new PackingListRules(seasonQuery(LocalDate.of(2027, 2, 20), 2)).apply(List.of(
                item("반려견 케어", "담요", "늦겨울이라 차 안에 깔아 보온해요."))))
                .extracting(PackingItem::name).contains("담요");
            assertThat(new PackingListRules(seasonQuery(NOVEMBER, 3)).apply(List.of(
                item("반려견 케어", "물티슈", "1일차 협재해수욕장 모래가 늦여름처럼 달궈져 발을 닦아요."),
                item("반려견 케어", "담요", "1일차 협재해수욕장이 한겨울처럼 추워 차 안에 깔아 보온해요."))))
                .extracting(PackingItem::name).doesNotContain("물티슈", "담요");
        }

        @Test
        @DisplayName("제주 여행이면 입도 수단은 사실이다 — '비행기로 이동해 멀미약을 챙겨요'. 제주가 아니면 아니다")
        void jejuTransportIsAFact() {
            List<PackingItem> model = List.of(item("이동 중", "멀미약", "비행기로 이동해 멀미약을 챙겨요."));

            assertThat(new PackingListRules(contextQuery(outline(JEJU, List.of(place("협재해수욕장"))))).apply(model))
                .extracting(PackingItem::name).contains("멀미약");
            assertThat(new PackingListRules(contextQuery(outline("6", List.of(place("해운대해수욕장"))))).apply(model))
                .extracting(PackingItem::name).doesNotContain("멀미약");
        }

        @Test
        @DisplayName("일정의 섬은 두 글자여도 사실이다 — '우도에서 배를 타면 멀미할 수 있어요'")
        void islandNameIsAFact() {
            List<PackingItem> model = List.of(item("이동 중", "멀미약", "우도에서 배를 타면 멀미할 수 있어요."));
            // 지역코드가 없는 일정이라 '배를 타' 는 입도 사실이 아니다 — 섬 이름만으로 선다.
            PlanOutline withUdo = outline(null, List.of(place("협재해수욕장")), List.of(place("우도봉")));

            assertThat(new PackingListRules(contextQuery(withUdo)).apply(model)).extracting(PackingItem::name).contains("멀미약");
            assertThat(new PackingListRules(contextQuery(outline(null, List.of(place("협재해수욕장"))))).apply(model))
                .extracting(PackingItem::name).doesNotContain("멀미약");
        }

        @Test
        @DisplayName("세 글자 섬 이름은 앞 낱말과 붙어도 섬이다 — '상추자도에서 배를 타면…' 은 추자도를 가리킨다")
        void threeSyllableIslandNeedsNoBoundary() {
            // 장소 이름(추자도등대전망대)은 이유에 없다 — 섬 이름만으로 선다.
            PlanOutline chuja = outline(null, List.of(place("추자도등대전망대")));

            assertThat(new PackingListRules(contextQuery(chuja)).apply(List.of(
                item("이동 중", "멀미약", "상추자도에서 배를 타면 멀미할 수 있어요."))))
                .extracting(PackingItem::name).contains("멀미약");
        }

        @Test
        @DisplayName("한 글자 '배' 는 입도 사실이 아니다 — '배탈' · '배를 채워'. '비우도록' 의 '우도' 는 섬이 아니다")
        void bellyIsNotABoat() {
            PackingChecklistQuery jeju = contextQuery(outline(JEJU, List.of(place("우도봉"))));

            List<PackingItem> packed = new PackingListRules(jeju).apply(List.of(
                item("이동 중", "멀미약", "배탈이 나지 않게 차량 이동 전에 챙겨요."),
                item("반려견 케어", "물티슈", "배를 채워 준 뒤 입가를 닦아요."),
                item("반려견 케어", "배변패드", "배변을 미리 비우도록 깔아요.")));

            assertThat(packed).extracting(PackingItem::name).doesNotContain("멀미약", "물티슈", "배변패드");
        }
    }

    private static List<PackingItem> rules(PackingChecklistQuery query) {
        return new PackingListRules(query).apply(List.of());
    }

    /** 기본 일정 — 1일차 해변 · 카페, 2일차 숲길. 모델 품목의 이유가 가리킬 사실이다 (#1336). */
    private static PackingChecklistQuery query(int days, List<PetCondition> pets, DayWeatherOutlook... outlooks) {
        return query(days, pets, plan(List.of("협재해수욕장", "카페 델문도"), List.of("사려니숲길")), outlooks);
    }

    private static PackingChecklistQuery query(int days, List<PetCondition> pets, PlanOutline plan,
        DayWeatherOutlook... outlooks) {
        return PackingChecklistQuery.builder()
            .startDate(START.toString())
            .endDate(START.plusDays(days - 1L).toString())
            .petConditions(pets)
            .weatherOutlook(List.of(outlooks))
            .planOutline(plan)
            .build();
    }

    @SafeVarargs
    private static PlanOutline plan(List<String>... titlesByDay) {
        List<PlanOutlineDay> days = new ArrayList<>();
        for (int index = 0; index < titlesByDay.length; index++) {
            days.add(PlanOutlineDay.builder().day(index + 1)
                .items(titlesByDay[index].stream()
                    .map(title -> PlanOutlineItem.builder().title(title).itemType("PLACE").placeId((long) title.hashCode()).build())
                    .toList())
                .build());
        }
        return PlanOutline.builder().planId(1L).days(days).build();
    }

    /** 계절 테스트의 질의 — 기본 일정(제주 지역코드 없음 · 섬 없음)이라 이동장이 섞이지 않는다 (#1435). */
    private static PackingChecklistQuery seasonQuery(LocalDate start, int days, DayWeatherOutlook... outlooks) {
        return PackingChecklistQuery.builder()
            .startDate(start.toString())
            .endDate(start.plusDays(days - 1L).toString())
            .petConditions(List.of())
            .weatherOutlook(List.of(outlooks))
            .planOutline(plan(List.of("협재해수욕장", "카페 델문도"), List.of("사려니숲길")))
            .build();
    }

    /** 여행 맥락 테스트의 질의 — 10월에 시작하는 사흘 여행이라 계절 품목이 섞이지 않는다 (#1435). */
    private static PackingChecklistQuery contextQuery(PlanOutline plan) {
        return query(3, List.of(), plan);
    }

    /** 항목 종류를 정해 짜는 일정. 섬 판정이 종류를 본다 (#1435). */
    @SafeVarargs
    private static PlanOutline outline(String areaCode, List<PlanOutlineItem>... itemsByDay) {
        List<PlanOutlineDay> days = new ArrayList<>();
        for (int index = 0; index < itemsByDay.length; index++) {
            days.add(PlanOutlineDay.builder().day(index + 1).items(itemsByDay[index]).build());
        }
        return PlanOutline.builder().planId(1L).areaCode(areaCode).days(days).build();
    }

    private static PlanOutlineItem place(String title) {
        return PlanOutlineItem.builder().title(title).itemType("PLACE").placeId((long) title.hashCode()).build();
    }

    private static PlanOutlineItem walk(String title) {
        return PlanOutlineItem.builder().title(title).itemType("WALK").build();
    }

    private static PlanOutlineItem meal(String title) {
        return PlanOutlineItem.builder().title(title).itemType("MEAL").placeId((long) title.hashCode()).build();
    }

    private static PlanOutlineItem lodging(String title) {
        return PlanOutlineItem.builder().title(title).itemType("LODGING").placeId((long) title.hashCode()).build();
    }

    private static PlanOutlineItem move(String title) {
        return PlanOutlineItem.builder().title(title).itemType("MOVE").build();
    }

    private static DayWeatherOutlook day(int offset, int precipitation, double min, double max) {
        return DayWeatherOutlook.builder().date(START.plusDays(offset))
            .maxPrecipitationProbability(precipitation).minTemperature(min).maxTemperature(max).build();
    }

    /** 날짜를 정해 둔 맑은 날 예보. 강수 10% 라 비 품목이 서지 않는다. */
    private static DayWeatherOutlook on(LocalDate date, double min, double max) {
        return DayWeatherOutlook.builder().date(date).maxPrecipitationProbability(10).minTemperature(min).maxTemperature(max).build();
    }

    private static PetCondition maltese() {
        return PetCondition.builder().breed("말티즈").sizeName("소형견").heatSensitive(true).build();
    }

    private static PackingItem item(String category, String name, String reason) {
        return PackingItem.builder().category(category).name(name).reason(reason).build();
    }

    private static PackingItem find(List<PackingItem> items, String name) {
        return items.stream().filter(item -> item.name().equals(name)).findFirst()
            .orElseThrow(() -> new AssertionError(name + " 이(가) 없다: " + items));
    }
}
