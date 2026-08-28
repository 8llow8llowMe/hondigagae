package com.hondigagae.domainlayer.planner.adapter.out.llm;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.planner.application.model.AiPlanGenerationQuery;
import com.hondigagae.domainlayer.planner.application.model.PetCondition;
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
    @DisplayName("반려견 특성이 있으면 크기·체중·민감성·산책 선호가 프롬프트에 실린다")
    void petSectionCarriesTraits() {
        String prompt = factory.userPrompt(query(List.of(PetCondition.builder()
            .breed("골든 리트리버")
            .sizeName("대형견")
            .weightText("28.5")
            .heatSensitive(true)
            .walkPreferred(true)
            .build())));

        assertThat(prompt).contains("함께 여행하는 반려견");
        assertThat(prompt).contains("대형견");
        assertThat(prompt).contains("체중: 28.5kg");
        assertThat(prompt).contains("더위에 민감함");
        assertThat(prompt).contains("산책을 좋아함");
        // 켜지 않은 특성은 지어 적지 않는다
        assertThat(prompt).doesNotContain("추위에 민감함");
        // 한 마리일 때는 다중 판정 규칙이 붙지 않는다
        assertThat(prompt).doesNotContain("가장 큰 크기와 가장 무거운 체중");
    }

    @Test
    @DisplayName("여러 마리면 각 반려견 특성과 '가장 제약이 큰 기준' 규칙이 실린다")
    void multiplePetsCarryPerPetTraitsAndStrictestRule() {
        String prompt = factory.userPrompt(query(List.of(
            PetCondition.builder().sizeName("소형견").weightText("3.5").noiseSensitive(true).build(),
            PetCondition.builder().sizeName("대형견").weightText("28").heatSensitive(true).build())));

        assertThat(prompt).contains("함께 여행하는 반려견 2마리");
        assertThat(prompt).contains("[반려견 1]");
        assertThat(prompt).contains("[반려견 2]");
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
