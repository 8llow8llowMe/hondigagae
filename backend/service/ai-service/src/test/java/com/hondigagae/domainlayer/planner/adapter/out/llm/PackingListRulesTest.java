package com.hondigagae.domainlayer.planner.adapter.out.llm;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.planner.application.model.DayWeatherOutlook;
import com.hondigagae.domainlayer.planner.application.model.PackingChecklistQuery;
import com.hondigagae.domainlayer.planner.application.model.PetCondition;
import com.hondigagae.domainlayer.planner.domain.model.PackingList.PackingItem;
import java.time.LocalDate;
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
                item("이동 중", "이동장", "장거리 차량 이동 준비가 필요해요."),
                item("반려견 케어", "물티슈", "비 예보는 없지만 해변 뒤 발을 닦아요.")));

            assertThat(find(packed, "이동장").reason()).isEqualTo("장거리 차량 이동 준비가 필요해요.");
            assertThat(find(packed, "물티슈").reason()).isEqualTo("비 예보는 없지만 해변 뒤 발을 닦아요.");
        }

        @Test
        @DisplayName("구명조끼 · 방수 배변패드는 옷 · 우비가 아니다 — 서버 종류 낱말에 걸려도 받는다")
        void safetyAndPadsAreNotWeatherGear() {
            List<PackingItem> packed = new PackingListRules(query(1, List.of())).apply(List.of(
                item("반려견 케어", "반려견 구명조끼", "카약 체험 일정이 있어요."),
                item("반려견 케어", "라이프 재킷", "패들보드 일정이 있어요."),
                item("이동 중", "방수 배변패드", "차 안에서 깔아요.")));

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
        @DisplayName("이유가 없던 목록 안 품목은 남는다 — 틀린 말을 한 것이 아니다")
        void keepsExtraWithoutReason() {
            List<PackingItem> packed = new PackingListRules(query(1, List.of())).apply(List.of(
                item("반려견 케어", "물티슈", null), item("반려견 케어", "인식표", " ")));

            assertThat(packed).extracting(PackingItem::name).contains("물티슈", "인식표");
        }

        @Test
        @DisplayName("사람용 캐리어는 목록 밖이다. 펫 캐리어는 받는다")
        void humanLuggageIsNotAnExtra() {
            List<PackingItem> packed = new PackingListRules(query(1, List.of())).apply(List.of(
                item("이동 중", "기내용 캐리어", "짐을 담아요."), item("이동 중", "펫 캐리어", "비행기 탑승 일정이 있어요.")));

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

    private static List<PackingItem> rules(PackingChecklistQuery query) {
        return new PackingListRules(query).apply(List.of());
    }

    private static PackingChecklistQuery query(int days, List<PetCondition> pets, DayWeatherOutlook... outlooks) {
        return PackingChecklistQuery.builder()
            .startDate(START.toString())
            .endDate(START.plusDays(days - 1L).toString())
            .petConditions(pets)
            .weatherOutlook(List.of(outlooks))
            .build();
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
