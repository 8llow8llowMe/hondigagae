package com.hondigagae.domainlayer.planner.adapter.out.llm;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.planner.application.model.AiPlanGenerationQuery;
import com.hondigagae.domainlayer.planner.application.model.PetCondition;
import com.hondigagae.domainlayer.planner.application.model.PlaceCandidate;
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
    @DisplayName("반려견 특성이 있으면 크기·민감성·산책 선호가 프롬프트에 실린다")
    void petSectionCarriesTraits() {
        String prompt = factory.userPrompt(query(PetCondition.builder()
            .breed("골든 리트리버")
            .sizeName("대형견")
            .heatSensitive(true)
            .walkPreferred(true)
            .build()));

        assertThat(prompt).contains("함께 여행하는 반려견");
        assertThat(prompt).contains("대형견");
        assertThat(prompt).contains("더위에 민감함");
        assertThat(prompt).contains("산책을 좋아함");
        // 켜지 않은 특성은 지어 적지 않는다
        assertThat(prompt).doesNotContain("추위에 민감함");
    }

    @Test
    @DisplayName("특성이 없으면(조회 실패·프로필 부재) 반려견 절 자체를 생략한다")
    void missingConditionOmitsSection() {
        String prompt = factory.userPrompt(query(null));

        assertThat(prompt).doesNotContain("함께 여행하는 반려견");
        // 후보 목록 등 나머지 절은 그대로 있어야 한다
        assertThat(prompt).contains("후보 장소");
    }

    private AiPlanGenerationQuery query(PetCondition petCondition) {
        return AiPlanGenerationQuery.builder()
            .areaCode("39")
            .startDate("2026-09-01")
            .endDate("2026-09-02")
            .petCondition(petCondition)
            .placeCandidates(List.of(
                new PlaceCandidate(1L, "장소", "관광지", "제주", "동반 가능", true, "여행지", 33.5, 126.5)))
            .build();
    }
}
