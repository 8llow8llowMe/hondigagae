package com.hondigagae.domainlayer.planner.adapter.out.llm;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.planner.application.model.AiPlanGenerationQuery;
import com.hondigagae.domainlayer.planner.application.model.PackingChecklistQuery;
import com.hondigagae.domainlayer.planner.application.model.PetCondition;
import com.hondigagae.domainlayer.planner.application.model.PlanOutline;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 준비물 프롬프트의 다견 규칙 검증.
 *
 * <p><b>일정 생성과 규칙이 반대</b>라는 것이 이 테스트의 요점이다.
 *
 * <ul>
 *   <li>일정 생성 — 가장 제약이 큰 아이가 기준. 한 마리라도 못 들어가면 그 장소는 못 간다</li>
 *   <li>준비물 — 합집합. 더위에 약한 아이의 쿨매트와 추위에 약한 아이의 옷이 둘 다 필요하다</li>
 * </ul>
 *
 * <p>둘이 같은 절({@code appendPetSection})을 쓰기 때문에, 규칙을 호출부가 주지 않으면
 * 한쪽이 다른 쪽 규칙을 그대로 받는다. 예전에 준비물 프롬프트가 입장 제한 규칙을 받고 있던
 * 것이 그 상태였다.
 */
class PackingPromptMultiPetTest {

    private final AiPlanPromptFactory promptFactory = new AiPlanPromptFactory();

    @Test
    @DisplayName("여러 마리면 아이별로 나열한다")
    void listsEveryPet() {
        String prompt = promptFactory.packingUserPrompt(packingQuery(List.of(hotSensitive(), coldSensitive())));

        assertThat(prompt).contains("함께 여행하는 반려견 2마리");
        assertThat(prompt).contains("[반려견 1]").contains("[반려견 2]");
        // 두 아이의 특성이 모두 실려야 한다 - 절반이 빠지면 근거 문장이 신뢰를 잃는다.
        assertThat(prompt).contains("말티즈").contains("리트리버");
    }

    @Test
    @DisplayName("준비물은 합집합 규칙을 싣는다 — 한 아이에게만 필요한 물건도 빠뜨리지 않는다")
    void carriesUnionRule() {
        String prompt = promptFactory.packingUserPrompt(packingQuery(List.of(hotSensitive(), coldSensitive())));

        assertThat(prompt).contains("아이마다 필요한 물건을 모두 넣을 것");
        // 어느 아이 때문인지 밝히게 해야 합집합으로 만들어도 근거가 흐려지지 않는다.
        assertThat(prompt).contains("어느 아이인지 밝힐 것");
    }

    @Test
    @DisplayName("준비물에 일정 생성의 입장 제한 규칙이 섞이지 않는다")
    void doesNotCarryPlanEntryRule() {
        // 준비물은 장소를 고르는 일이 아니라 물건을 챙기는 일이다. 입장 제한은 상관이 없고,
        // "가장 제약이 큰 아이" 로 접으라는 지시가 섞이면 다른 아이 물건이 빠진다.
        String prompt = promptFactory.packingUserPrompt(packingQuery(List.of(hotSensitive(), coldSensitive())));

        assertThat(prompt).doesNotContain("입장 제한");
    }

    @Test
    @DisplayName("일정 생성은 가장 제약이 큰 아이 규칙을 그대로 쓴다")
    void planPromptKeepsMostRestrictiveRule() {
        String prompt = promptFactory.userPrompt(planQuery(List.of(hotSensitive(), coldSensitive())));

        assertThat(prompt).contains("입장 제한");
        assertThat(prompt).doesNotContain("아이마다 필요한 물건");
    }

    @Test
    @DisplayName("한 마리면 다견 규칙을 싣지 않는다")
    void addsNoMultiPetRuleForSinglePet() {
        String prompt = promptFactory.packingUserPrompt(packingQuery(List.of(hotSensitive())));

        assertThat(prompt).contains("함께 여행하는 반려견");
        assertThat(prompt).doesNotContain("마리");
        assertThat(prompt).doesNotContain("아이마다 필요한 물건");
    }

    @Test
    @DisplayName("특성이 없으면 반려견 절 자체가 빠진다 — 지어내지 않는다")
    void omitsSectionWithoutConditions() {
        String prompt = promptFactory.packingUserPrompt(packingQuery(List.of()));

        assertThat(prompt).doesNotContain("함께 여행하는 반려견");
    }

    // --- fixtures ---

    private PackingChecklistQuery packingQuery(List<PetCondition> pets) {
        return PackingChecklistQuery.builder()
            .startDate("2026-09-12").endDate("2026-09-14")
            .petConditions(pets)
            .planOutline(PlanOutline.builder()
                .planId(1L).areaCode("39").startDate("2026-09-12").endDate("2026-09-14")
                .days(List.of())
                .build())
            .build();
    }

    private AiPlanGenerationQuery planQuery(List<PetCondition> pets) {
        return AiPlanGenerationQuery.builder()
            .areaCode("39").startDate("2026-09-12").endDate("2026-09-14")
            .petConditions(pets)
            .build();
    }

    private PetCondition hotSensitive() {
        return PetCondition.builder()
            .breed("말티즈").sizeName("소형견").weightText("3.5")
            .heatSensitive(true).activityName("보통")
            .build();
    }

    private PetCondition coldSensitive() {
        return PetCondition.builder()
            .breed("리트리버").sizeName("대형견").weightText("30.0")
            .coldSensitive(true).activityName("높음")
            .build();
    }
}
