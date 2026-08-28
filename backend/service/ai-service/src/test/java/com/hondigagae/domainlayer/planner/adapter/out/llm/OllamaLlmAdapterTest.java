package com.hondigagae.domainlayer.planner.adapter.out.llm;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hondigagae.domainlayer.planner.application.exception.AiPlanErrorCode;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanException;
import com.hondigagae.domainlayer.planner.application.model.AiPlanGenerationQuery;
import com.hondigagae.domainlayer.planner.application.model.PlaceCandidate;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft;
import com.hondigagae.global.properties.AiLlmProperties;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.ollama.OllamaChatModel;

/**
 * Spring AI 어댑터 검증. 핵심은 provider 를 바꿔도 지켜져야 하는 두 가지다 —
 * 스키마 밖 응답을 파싱 실패로 처리하는 것, 후보 밖 장소(환각)의 링크를 끊는 것.
 */
@ExtendWith(MockitoExtension.class)
class OllamaLlmAdapterTest {

    @Mock
    private OllamaChatModel ollamaChatModel;

    private OllamaLlmAdapter adapter;

    @BeforeEach
    void setUp() {
        AiLlmProperties properties = new AiLlmProperties(
            true, null, null, null, null, null, null, null, null, null);
        adapter = new OllamaLlmAdapter(
            ollamaChatModel, new AiPlanPromptFactory(), properties, CircuitBreakerRegistry.ofDefaults());
    }

    @Test
    @DisplayName("정상 JSON 응답을 도메인 일정안으로 바꾸고, 장소명은 후보 데이터의 이름으로 맞춘다")
    void convertsJsonToDraftUsingCandidateTitles() {
        stubResponse("""
            {"days":[{"day":1,"items":[
              {"itemType":"PLACE","placeId":100,"title":"모델이 바꿔 적은 이름","note":"산책"}]}],
             "reasons":[{"code":"PET_FRIENDLY","name":"동반 가능","description":"확인된 곳만 담았습니다."}]}
            """);

        AiPlanDraft draft = adapter.generatePlanDraft(query(candidate(100L, "우리 데이터 장소명")));

        assertThat(draft.days()).hasSize(1);
        assertThat(draft.days().get(0).items().get(0).placeId()).isEqualTo(100L);
        // 모델이 이름을 조금씩 바꿔 적는 일이 있어 후보의 이름을 쓴다
        assertThat(draft.days().get(0).items().get(0).title()).isEqualTo("우리 데이터 장소명");
        assertThat(draft.reasons()).hasSize(1);
    }

    @Test
    @DisplayName("후보 목록에 없는 placeId 는 링크만 끊고 항목은 일정 흐름으로 남긴다 (환각 방지)")
    void unknownPlaceIdKeepsItemButDropsLink() {
        stubResponse("""
            {"days":[{"day":1,"items":[
              {"itemType":"PLACE","placeId":999,"title":"존재하지 않는 장소","note":"모델이 지어냄"}]}],
             "reasons":[]}
            """);

        AiPlanDraft draft = adapter.generatePlanDraft(query(candidate(100L, "실제 장소")));

        assertThat(draft.days().get(0).items()).hasSize(1);
        assertThat(draft.days().get(0).items().get(0).placeId()).isNull();
        assertThat(draft.days().get(0).items().get(0).title()).isEqualTo("존재하지 않는 장소");
    }

    @Test
    @DisplayName("마크다운 코드 펜스로 감싼 JSON 도 해석한다 — 로컬 모델이 자주 내는 형태다")
    void toleratesMarkdownFencedJson() {
        stubResponse("""
            ```json
            {"days":[{"day":1,"items":[]}],"reasons":[]}
            ```
            """);

        assertThat(adapter.generatePlanDraft(query(candidate(100L, "장소"))).days()).hasSize(1);
    }

    @Test
    @DisplayName("스키마로 해석할 수 없는 응답은 LLM_RESPONSE_INVALID 다")
    void nonJsonResponseFailsAsInvalid() {
        stubResponse("일정을 만들어 드리겠습니다! 첫째 날은...");

        assertThatThrownBy(() -> adapter.generatePlanDraft(query(candidate(100L, "장소"))))
            .isInstanceOf(AiPlanException.class)
            .extracting(e -> ((AiPlanException) e).getErrorCode())
            .isEqualTo(AiPlanErrorCode.LLM_RESPONSE_INVALID);
    }

    @Test
    @DisplayName("빈 본문도 LLM_RESPONSE_INVALID — 어느 지점에서 비었는지 로그로 갈라 남긴다")
    void blankBodyFailsAsInvalid() {
        stubResponse("");

        assertThatThrownBy(() -> adapter.generatePlanDraft(query(candidate(100L, "장소"))))
            .isInstanceOf(AiPlanException.class)
            .extracting(e -> ((AiPlanException) e).getErrorCode())
            .isEqualTo(AiPlanErrorCode.LLM_RESPONSE_INVALID);
    }

    @Test
    @DisplayName("후보가 없으면 모델을 부르지 않고 실패시킨다 — 기억으로 장소를 지어내게 두지 않는다")
    void emptyCandidatesFailBeforeCallingModel() {
        assertThatThrownBy(() -> adapter.generatePlanDraft(query()))
            .isInstanceOf(AiPlanException.class)
            .extracting(e -> ((AiPlanException) e).getErrorCode())
            .isEqualTo(AiPlanErrorCode.NO_PLACE_CANDIDATES);
        verify(ollamaChatModel, never()).call(any(Prompt.class));
    }

    @Test
    @DisplayName("모델 호출 실패는 LLM_UNAVAILABLE 로 올린다")
    void modelFailureIsUnavailable() {
        when(ollamaChatModel.call(any(Prompt.class))).thenThrow(new IllegalStateException("connection refused"));

        assertThatThrownBy(() -> adapter.generatePlanDraft(query(candidate(100L, "장소"))))
            .isInstanceOf(AiPlanException.class)
            .extracting(e -> ((AiPlanException) e).getErrorCode())
            .isEqualTo(AiPlanErrorCode.LLM_UNAVAILABLE);
    }

    private void stubResponse(String text) {
        when(ollamaChatModel.call(any(Prompt.class)))
            .thenReturn(new ChatResponse(List.of(new Generation(new AssistantMessage(text)))));
    }

    private AiPlanGenerationQuery query(PlaceCandidate... candidates) {
        return AiPlanGenerationQuery.builder()
            .areaCode("39")
            .startDate("2026-09-01")
            .endDate("2026-09-02")
            .placeCandidates(List.of(candidates))
            .build();
    }

    private PlaceCandidate candidate(long placeId, String title) {
        return new PlaceCandidate(placeId, title, "관광지", "제주특별자치도", "동반 가능", true, "여행지", 33.5, 126.5);
    }
}
