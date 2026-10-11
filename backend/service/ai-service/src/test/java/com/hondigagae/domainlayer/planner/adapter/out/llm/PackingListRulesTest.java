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
        @DisplayName("전망이 없으면 날씨 품목을 넣지 않는다 — 모르는 날씨를 지어내지 않는다")
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

    private static DayWeatherOutlook day(int offset, int precipitation, double min, double max) {
        return DayWeatherOutlook.builder().date(START.plusDays(offset))
            .maxPrecipitationProbability(precipitation).minTemperature(min).maxTemperature(max).build();
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
