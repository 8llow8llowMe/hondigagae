package com.hondigagae.domainlayer.planner.adapter.out.llm;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.planner.adapter.out.llm.dto.LlmPlanDraftResponse;
import com.hondigagae.domainlayer.planner.application.model.AiPlanGenerationQuery;
import com.hondigagae.domainlayer.planner.application.model.DayWeatherOutlook;
import com.hondigagae.domainlayer.planner.application.model.PackingChecklistQuery;
import com.hondigagae.domainlayer.planner.application.model.PetCondition;
import com.hondigagae.domainlayer.planner.application.model.PlaceCandidate;
import com.hondigagae.global.properties.AiLlmProperties;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.converter.BeanOutputConverter;

/**
 * 일정 생성 프롬프트가 얼마나 큰가 (#232).
 *
 * <p>dev 에서 일정 생성만 실패하고 준비물 생성은 성공했다. 두 경로의 차이는 <b>프롬프트
 * 크기</b>뿐이라, 그 크기가 모델 컨텍스트 안에 들어오는지가 첫 질문이었다.
 *
 * <p>여기서 재는 것은 문자 수다. 토큰 수는 모델 토크나이저에 달렸지만, 한국어는 대체로
 * <b>글자 하나가 토큰 하나 이상</b>이라 문자 수는 토큰 수의 하한으로 쓸 수 있다. 그 하한이
 * 이미 Ollama 기본 컨텍스트(2,048 토큰)를 크게 넘는다는 것이 이 테스트가 고정하는 사실이다.
 *
 * <p>그래서 {@code num_ctx} 를 명시하지 않으면 프롬프트가 조용히 잘리고, 잘린 자리에 출력
 * 스키마 지시가 있으면 모델이 스키마 밖 응답을 내놓는다 — 그것이 AIPLAN_010 이다.
 */
class PlanPromptSizeTest {

    /**
     * Ollama 가 요청에 {@code num_ctx} 가 없을 때 쓰는 기본 컨텍스트(토큰).
     *
     * <p>모델이 128k 를 지원하든 이 값이 상한이 된다 — 서버 기본값이라 모델 능력과 무관하다.
     */
    private static final int OLLAMA_DEFAULT_CONTEXT_TOKENS = 2_048;

    /** 운영 기본 후보 수 (`ai-llm.place-candidate-size`). */
    private static final int PRODUCTION_CANDIDATE_SIZE = 50;

    private final AiPlanPromptFactory promptFactory = new AiPlanPromptFactory();
    private final BeanOutputConverter<LlmPlanDraftResponse> outputConverter =
        new BeanOutputConverter<>(LlmPlanDraftResponse.class);

    @Test
    @DisplayName("운영 기본값(후보 50곳)의 일정 프롬프트는 Ollama 기본 컨텍스트를 넘는다")
    void productionPromptExceedsOllamaDefaultContext() {
        String prompt = promptFactory.systemPrompt()
            + promptFactory.userPrompt(query(PRODUCTION_CANDIDATE_SIZE))
            + outputConverter.getFormat();

        // 한글은 글자 하나가 토큰 하나 이상이라 문자 수를 토큰 수의 하한으로 쓴다.
        assertThat(prompt.length()).isGreaterThan(OLLAMA_DEFAULT_CONTEXT_TOKENS);
    }

    @Test
    @DisplayName("준비물 프롬프트는 기본 컨텍스트 안에 들어온다 — 그래서 그쪽만 성공했다")
    void packingPromptFitsInOllamaDefaultContext() {
        // dev 관측(#232)과 맞는지 확인하는 대조군이다. 둘의 차이가 크기뿐이라는 근거.
        String prompt = promptFactory.packingSystemPrompt()
            + promptFactory.packingUserPrompt(packingQuery());

        assertThat(prompt.length()).isLessThan(OLLAMA_DEFAULT_CONTEXT_TOKENS);
    }

    @Test
    @DisplayName("기본 컨텍스트 창은 측정된 프롬프트보다 넉넉하다")
    void defaultContextWindowFitsTheMeasuredPrompt() {
        // 문자 수를 토큰 수의 하한으로 쓰는 같은 논리다. 창이 그 하한보다 작으면 확실히 잘리고,
        // 크더라도 여유가 얼마인지는 실제 promptTokens 로그로 확인해야 한다.
        String prompt = promptFactory.systemPrompt()
            + promptFactory.userPrompt(query(PRODUCTION_CANDIDATE_SIZE))
            + outputConverter.getFormat();
        AiLlmProperties defaults =
            new AiLlmProperties(null, null, null, null, null, null, null, null, null, null);

        assertThat(defaults.contextTokens()).isGreaterThan(prompt.length());
        // 출력도 같은 창에 들어간다. 프롬프트 + 출력 예산이 창을 넘으면 다시 잘린다.
        assertThat(defaults.contextTokens()).isGreaterThan(prompt.length() + defaults.maxTokens());
    }

    @Test
    @DisplayName("후보가 늘면 프롬프트가 선형으로 커진다 — 컨텍스트를 후보 수에 맞춰야 한다")
    void promptGrowsWithCandidateCount() {
        int small = promptFactory.userPrompt(query(5)).length();
        int large = promptFactory.userPrompt(query(PRODUCTION_CANDIDATE_SIZE)).length();

        // 후보 한 곳이 한 줄이라 개수에 비례한다. place-candidate-size 를 올릴 때
        // context-tokens 도 함께 봐야 한다는 뜻이다.
        assertThat(large).isGreaterThan(small * 5);
    }

    /** 준비물 프롬프트는 후보 목록이 없다 — 그 차이가 크기 차이의 대부분이다. */
    private PackingChecklistQuery packingQuery() {
        return PackingChecklistQuery.builder()
            .startDate("2026-09-09")
            .endDate("2026-09-12")
            .petConditions(List.of(PetCondition.builder()
                .breed("포메라니안")
                .sizeName("소형견")
                .weightText("3.5")
                .heatSensitive(true)
                .activityName("보통")
                .build()))
            .weatherOutlook(weatherOutlook())
            .build();
    }

    private AiPlanGenerationQuery query(int candidateSize) {
        return AiPlanGenerationQuery.builder()
            .areaCode("39")
            .startDate("2026-09-09")
            .endDate("2026-09-12")
            .requestNote("실내 위주로 부탁해요")
            .petConditions(List.of(PetCondition.builder()
                .breed("포메라니안")
                .sizeName("소형견")
                .weightText("3.5")
                .heatSensitive(true)
                .activityName("보통")
                .build()))
            .weatherOutlook(weatherOutlook())
            .placeCandidates(candidates(candidateSize))
            .build();
    }

    /** dev 실패 조건과 같은 4일치 전망. */
    private List<DayWeatherOutlook> weatherOutlook() {
        List<DayWeatherOutlook> outlook = new ArrayList<>();
        for (int day = 9; day <= 12; day++) {
            outlook.add(DayWeatherOutlook.builder()
                .date(LocalDate.of(2026, 9, day))
                .maxTemperature(29.0d)
                .minTemperature(22.0d)
                .maxPrecipitationProbability(60)
                .precipitationTypeName("비")
                .skyStateName("흐림")
                .build());
        }
        return outlook;
    }

    /** 실제 tour-service 응답과 비슷한 길이의 후보. 짧게 만들면 크기를 과소평가한다. */
    private List<PlaceCandidate> candidates(int size) {
        List<PlaceCandidate> candidates = new ArrayList<>();
        for (int index = 0; index < size; index++) {
            candidates.add(PlaceCandidate.builder()
                .placeId(212481712381923328L + index)
                .title("제주 반려견 동반 카페 " + index + "호점")
                .contentTypeName("음식점")
                .addr("제주특별자치도 제주시 한림읍 애월해안로 " + (100 + index))
                .petAllowanceName("동반 가능")
                .allowedPetSizeName("소형견")
                .maxPetWeightKg(10)
                .indoor(index % 2 == 0)
                .sourceCategory("반려동물 동반 여행지")
                .lat(33.5)
                .lng(126.5)
                .build());
        }
        return candidates;
    }
}
