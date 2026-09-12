package com.hondigagae.domainlayer.planner.adapter.out.llm;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.planner.application.model.AiPlanGenerationQuery;
import com.hondigagae.domainlayer.planner.application.model.DayWeatherOutlook;
import com.hondigagae.domainlayer.planner.application.model.PackingChecklistQuery;
import com.hondigagae.domainlayer.planner.application.model.PetCondition;
import com.hondigagae.domainlayer.planner.application.model.PetLifeStage;
import com.hondigagae.domainlayer.planner.application.model.PlaceCandidate;
import com.hondigagae.domainlayer.planner.application.model.PlanOutline;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 프롬프트에 반려견 특성이 실리는지 검증. 이 절이 빠지면 "반려견 맞춤"은
 * 시스템 프롬프트의 빈 구호가 된다 — 모델이 어떤 반려견인지 모른 채 일정을 짠다.
 */
class AiPlanPromptFactoryTest {

    private final AiPlanPromptFactory factory = new AiPlanPromptFactory();

    @Test
    @DisplayName("생애 단계를 값으로 적는다 — 나이와 무관한 \"노령견\" 단정을 막는다 (#493)")
    void writesLifeStageForAge() {
        String prompt = factory.userPrompt(query(List.of(PetCondition.builder()
            .ageText("6년")
            .lifeStage(PetLifeStage.ADULT)
            .build())));

        assertThat(prompt).contains("- 나이: 6년 (성견)");
        // 성견에는 활동 제약이 없다 — 괄호 뒤에 아무것도 붙지 않는다
        assertThat(prompt).doesNotContain("노령견");
    }

    @Test
    @DisplayName("노령견에는 단계와 함께 활동 제약을 적는다")
    void writesSeniorGuidance() {
        String prompt = factory.userPrompt(query(List.of(PetCondition.builder()
            .ageText("11년 2개월")
            .lifeStage(PetLifeStage.SENIOR)
            .build())));

        assertThat(prompt).contains("- 나이: 11년 2개월 (노령견) - 이동과 도보를 줄이고 휴식을 자주 둘 것");
    }

    @Test
    @DisplayName("나이는 있는데 단계를 모르면 단계를 지어 적지 않는다")
    void omitsLifeStageWhenUnknown() {
        String prompt = factory.userPrompt(query(List.of(PetCondition.builder()
            .ageText("6년")
            .build())));

        assertThat(prompt).contains("- 나이: 6년");
        assertThat(prompt).doesNotContain("(성견)");
        assertThat(prompt).doesNotContain("노령견");
    }

    @Test
    @DisplayName("시스템 프롬프트가 말투·조사·생애 단계를 못 박는다 (#493)")
    void systemPromptPinsTextRules() {
        String system = factory.systemPrompt();

        assertThat(system).contains("~해요");
        assertThat(system).contains("조사");
        assertThat(system).contains("생애 단계는 입력에 적힌 표현만");
    }
    @Test
    @DisplayName("반려견 특성이 있으면 크기·체중·민감성·산책 선호가 프롬프트에 실린다")
    void petSectionCarriesTraits() {
        String prompt = factory.userPrompt(query(List.of(PetCondition.builder()
            .breed("골든 리트리버")
            .sizeName("대형견")
            .weightText("28.5")
            .ageText("11년 2개월")
            .heatSensitive(true)
            .walkPreferred(true)
            .lowSociality(true)
            .build())));

        assertThat(prompt).contains("함께 여행하는 반려견");
        assertThat(prompt).contains("대형견");
        assertThat(prompt).contains("체중: 28.5kg");
        // 나이가 있어야 노령견과 퍼피가 다른 일정을 받는다 (#367)
        assertThat(prompt).contains("나이: 11년 2개월");
        assertThat(prompt).contains("더위에 민감함");
        assertThat(prompt).contains("산책을 좋아함");
        // 필수 입력인 사회성을 받아 놓고 버리면 안 된다 (#380). 낮음일 때만 제약으로 싣는다
        assertThat(prompt).contains("사회성이 낮음");
        // 켜지 않은 특성은 지어 적지 않는다
        assertThat(prompt).doesNotContain("추위에 민감함");
        // 한 마리일 때는 다중 판정 규칙이 붙지 않는다
        assertThat(prompt).doesNotContain("가장 큰 크기와 가장 무거운 체중");
    }

    @Test
    @DisplayName("나이를 모르면 나이 줄을 지어 적지 않는다")
    void unknownAgeOmitsAgeLine() {
        String prompt = factory.userPrompt(query(List.of(PetCondition.builder()
            .sizeName("소형견")
            .build())));

        assertThat(prompt).doesNotContain("나이:");
        // 사회성 보통/높음은 제약이 아니다 - 줄을 만들지 않는다
        assertThat(prompt).doesNotContain("사회성이 낮음");
    }

    @Test
    @DisplayName("여러 마리면 각 반려견 특성과 '가장 제약이 큰 기준' 규칙이 실린다")
    void multiplePetsCarryPerPetTraitsAndStrictestRule() {
        String prompt = factory.userPrompt(query(List.of(
            PetCondition.builder().sizeName("소형견").weightText("3.5").noiseSensitive(true).build(),
            PetCondition.builder().sizeName("대형견").weightText("28").heatSensitive(true).build())));

        assertThat(prompt).contains("함께 여행하는 반려견 2마리");
        // 이유 문장이 가리킬 이름이라 대괄호 없이 쓴다 — 표기가 그대로 화면에 새기 때문 (#233)
        assertThat(prompt).contains("\n반려견 1\n");
        assertThat(prompt).contains("\n반려견 2\n");
        assertThat(prompt).doesNotContain("[반려견");
        assertThat(prompt).contains("소음에 민감함");
        assertThat(prompt).contains("더위에 민감함");
        assertThat(prompt).contains("가장 큰 크기와 가장 무거운 체중 기준으로 판정할 것");
    }

    @Test
    @DisplayName("특성이 없으면(조회 실패·프로필 부재) 반려견 절 자체를 생략한다")
    void missingConditionOmitsSection() {
        String prompt = factory.userPrompt(query(List.of()));

        assertThat(prompt).doesNotContain("함께 여행하는 반려견");
        // 후보 목록 등 나머지 절은 그대로 있어야 한다
        assertThat(prompt).contains("후보 장소");
    }

    @Test
    @DisplayName("필수 포함 장소는 후보 줄에 표시되고 배치 지시가 실린다")
    void pinnedPlacesAreMarkedAndInstructed() {
        AiPlanGenerationQuery query = AiPlanGenerationQuery.builder()
            .areaCode("39")
            .startDate("2026-09-01")
            .endDate("2026-09-02")
            .pinnedPlaceIds(List.of(1L))
            .placeCandidates(List.of(
                PlaceCandidate.builder().placeId(1L).title("꼭갈곳").lat(33.5).lng(126.5).build(),
                PlaceCandidate.builder().placeId(2L).title("보통후보").lat(33.4).lng(126.4).build()))
            .build();

        String prompt = factory.userPrompt(query);

        assertThat(prompt).contains("[필수 포함] placeId=1");
        assertThat(prompt).doesNotContain("[필수 포함] placeId=2");
        assertThat(prompt).contains("1곳을 빠짐없이 일정에 배치할 것");
    }

    @Test
    @DisplayName("선호 장소는 [선호]로 표시되고, 필수 포함과 겹치면 필수 표시가 이긴다")
    void favoritePlacesAreMarkedSoftly() {
        AiPlanGenerationQuery query = AiPlanGenerationQuery.builder()
            .areaCode("39")
            .startDate("2026-09-01")
            .endDate("2026-09-02")
            .pinnedPlaceIds(List.of(1L))
            .favoritePlaceIds(List.of(1L, 2L))
            .placeCandidates(List.of(
                PlaceCandidate.builder().placeId(1L).title("필수이자선호").lat(33.5).lng(126.5).build(),
                PlaceCandidate.builder().placeId(2L).title("선호만").lat(33.4).lng(126.4).build()))
            .build();

        String prompt = factory.userPrompt(query);

        assertThat(prompt).contains("[필수 포함] placeId=1");
        assertThat(prompt).contains("[선호] placeId=2");
        assertThat(prompt).doesNotContain("[선호] placeId=1");
        assertThat(prompt).contains("우선 배치할 것. 필수는 아님");
    }

    @Test
    @DisplayName("날씨 전망이 있으면 일차별 예보와 배치 지시가 실리고, 없으면 절을 생략한다")
    void weatherSectionCarriesOutlookAndInstruction() {
        AiPlanGenerationQuery query = AiPlanGenerationQuery.builder()
            .areaCode("39")
            .startDate("2026-09-01")
            .endDate("2026-09-02")
            .weatherOutlook(List.of(
                DayWeatherOutlook.builder()
                    .date(java.time.LocalDate.parse("2026-09-01"))
                    .skyStateName("맑음").maxPrecipitationProbability(10)
                    .minTemperature(24.0).maxTemperature(31.0)
                    .build(),
                DayWeatherOutlook.builder()
                    .date(java.time.LocalDate.parse("2026-09-02"))
                    .skyStateName("흐림").precipitationTypeName("비").maxPrecipitationProbability(80)
                    .build()))
            .placeCandidates(List.of(
                PlaceCandidate.builder().placeId(1L).title("장소").lat(33.5).lng(126.5).build()))
            .build();

        String prompt = factory.userPrompt(query);

        assertThat(prompt).contains("여행 기간 날씨 전망");
        assertThat(prompt).contains("- 1일차 2026-09-01 | 맑음");
        assertThat(prompt).contains("- 2일차 2026-09-02 | 흐림 | 강수형태: 비 | 강수확률 80%");
        assertThat(prompt).contains("기온 24.0~31.0℃");
        assertThat(prompt).contains("실내 후보 위주로 배치할 것");
        assertThat(prompt).contains("지어내지 말 것");

        // 전망이 없으면 절 자체를 생략한다
        String withoutWeather = factory.userPrompt(query(List.of()));
        assertThat(withoutWeather).doesNotContain("여행 기간 날씨 전망");
    }

    @Test
    @DisplayName("하루 재생성이면 기존 일정과 해당 일차만 새로 짜라는 지시가 실린다")
    void regenerateSectionCarriesOutlineAndInstruction() {
        AiPlanGenerationQuery query = AiPlanGenerationQuery.builder()
            .areaCode("39")
            .startDate("2026-09-01")
            .endDate("2026-09-02")
            .regenerateDay(2)
            .planOutline(PlanOutline.builder()
                .planId(7L)
                .days(List.of(
                    PlanOutline.PlanOutlineDay.builder().day(1).items(List.of(
                        PlanOutline.PlanOutlineItem.builder().title("사려니숲길").placeId(11L).build())).build(),
                    PlanOutline.PlanOutlineDay.builder().day(2).items(List.of()).build()))
                .build())
            .placeCandidates(List.of(
                PlaceCandidate.builder().placeId(11L).title("사려니숲길").lat(33.4).lng(126.6).build()))
            .build();

        String prompt = factory.userPrompt(query);

        assertThat(prompt).contains("기존 일정");
        assertThat(prompt).contains("사려니숲길(placeId=11)");
        assertThat(prompt).contains("2일차만 새로 구성할 것");
    }

    @Test
    @DisplayName("후보의 입장 크기·체중 제한이 있으면 후보 줄에 실린다")
    void candidateEntranceLimitsAppear() {
        String prompt = factory.userPrompt(query(List.of()));

        assertThat(prompt).contains("입장크기: 소형견");
        assertThat(prompt).contains("체중제한: 10kg");
    }

    @Test
    @DisplayName("준비물 프롬프트에 기간·반려견·날씨·일정 근거가 함께 실린다")
    void packingPromptCarriesAllEvidence() {
        PackingChecklistQuery query = PackingChecklistQuery.builder()
            .startDate("2026-09-01")
            .endDate("2026-09-02")
            .petConditions(List.of(PetCondition.builder()
                .sizeName("소형견").weightText("3.5").heatSensitive(true).build()))
            .weatherOutlook(List.of(DayWeatherOutlook.builder()
                .date(java.time.LocalDate.parse("2026-09-02"))
                .precipitationTypeName("비").maxPrecipitationProbability(80)
                .build()))
            .planOutline(PlanOutline.builder()
                .planId(7L)
                .days(List.of(PlanOutline.PlanOutlineDay.builder().day(1).items(List.of(
                    PlanOutline.PlanOutlineItem.builder().title("해안 산책로").placeId(11L).build())).build()))
                .build())
            .build();

        String prompt = factory.packingUserPrompt(query);

        assertThat(prompt).contains("기간: 2026-09-01 ~ 2026-09-02");
        assertThat(prompt).contains("함께 여행하는 반려견");
        assertThat(prompt).contains("체중: 3.5kg");
        assertThat(prompt).contains("- 2일차 2026-09-02 | 강수형태: 비 | 강수확률 80%");
        assertThat(prompt).contains("\n1일차 · 해안 산책로(placeId=11)");
        assertThat(prompt).contains("여행 일정");
        assertThat(prompt).contains("해안 산책로(placeId=11)");
        assertThat(prompt).contains("준비물 목록을 만들어 주세요");
        // 배치 지시는 일정 생성 전용 — 준비물 프롬프트에는 실리지 않는다
        assertThat(prompt).doesNotContain("실내 후보 위주로 배치할 것");
    }

    private AiPlanGenerationQuery query(List<PetCondition> petConditions) {
        return AiPlanGenerationQuery.builder()
            .areaCode("39")
            .startDate("2026-09-01")
            .endDate("2026-09-02")
            .petConditions(petConditions)
            .placeCandidates(List.of(PlaceCandidate.builder()
                .placeId(1L)
                .title("장소")
                .contentTypeName("관광지")
                .addr("제주")
                .petAllowanceName("동반 가능")
                .allowedPetSizeName("소형견")
                .maxPetWeightKg(10)
                .indoor(true)
                .sourceCategory("여행지")
                .lat(33.5)
                .lng(126.5)
                .build()))
            .build();
    }
}
