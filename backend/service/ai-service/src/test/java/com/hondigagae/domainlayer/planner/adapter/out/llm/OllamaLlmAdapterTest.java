package com.hondigagae.domainlayer.planner.adapter.out.llm;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanErrorCode;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanException;
import com.hondigagae.domainlayer.planner.application.model.AiPlanGenerationQuery;
import com.hondigagae.domainlayer.planner.application.model.DayWeatherOutlook;
import com.hondigagae.domainlayer.planner.application.model.PackingChecklistQuery;
import com.hondigagae.domainlayer.planner.application.model.PlaceCandidate;
import com.hondigagae.domainlayer.planner.application.model.PlanOutline;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft.AiPlanDraftItem;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanDraft.AiPlanDraftReason;
import com.hondigagae.domainlayer.planner.domain.model.PackingList;
import com.hondigagae.global.properties.AiLlmProperties;
import com.hondigagae.shared.travel.plan.PlanItemType;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import java.net.SocketTimeoutException;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.metadata.DefaultUsage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.ai.ollama.api.OllamaChatOptions;

/**
 * Spring AI 어댑터 검증. 핵심은 provider 를 바꿔도 지켜져야 하는 것들이다 —
 * 스키마 밖 응답을 파싱 실패로 처리하는 것, 모델이 적은 후보 번호를 서버의 후보로 되돌리는 것.
 *
 * <p>#1128 부터 모델은 <b>후보 번호와 메모만</b> 쓴다. 아이디 · 이름 · 종류 · 근거 이름은 어댑터가 후보와
 * 코드표로 채우므로, 그 채움이 실제로 일어나는지와 번호가 어긋났을 때 무엇을 버리는지를 여기서 고정한다.
 */
@ExtendWith(MockitoExtension.class)
class OllamaLlmAdapterTest {

    @Mock
    private OllamaChatModel ollamaChatModel;

    private OllamaLlmAdapter adapter;

    @BeforeEach
    void setUp() {
        adapter = adapter(defaultProperties());
    }

    @Test
    @DisplayName("후보 번호를 후보로 되돌려 아이디와 이름을 서버 데이터로 채운다")
    void mapsCandidateNumberToCandidate() {
        stubResponse("""
            {"days":[{"day":1,"items":[{"place":2,"note":"그늘에서 쉬어요."}],"lodging":null}],
             "reasons":[{"code":"PET_ALLOWED","description":"확인된 곳만 담았어요."}]}
            """);

        AiPlanDraft draft = adapter.generatePlanDraft(query(candidate(100L, "첫째 후보"), candidate(200L, "둘째 후보")));

        AiPlanDraftItem item = draft.days().get(0).items().get(0);
        // 번호는 1부터 시작하는 후보 목록의 순서다 — 2 는 둘째 후보다
        assertThat(item.placeId()).isEqualTo(200L);
        assertThat(item.title()).isEqualTo("둘째 후보");
        assertThat(item.note()).isEqualTo("그늘에서 쉬어요.");
        assertThat(draft.reasons()).hasSize(1);
    }

    @Test
    @DisplayName("항목 종류는 후보 분류로 정한다 — 숙박은 LODGING, 음식점은 MEAL, 그 밖은 PLACE")
    void derivesItemTypeFromCandidateContentType() {
        stubResponse("""
            {"days":[{"day":1,"items":[{"place":1,"note":"a"},{"place":2,"note":"b"},{"place":3,"note":"c"}],"lodging":null},
                     {"day":2,"items":[],"lodging":null},{"day":3,"items":[],"lodging":null}],
             "reasons":[]}
            """);

        AiPlanDraft draft = adapter.generatePlanDraft(query("2026-09-01", "2026-09-03",
            candidate(100L, "오설록"), restaurant(200L, "N109"), lodging(300L, "휘닉스아일랜드콘도")));

        assertThat(draft.days().get(0).items()).extracting(AiPlanDraftItem::itemType)
            .containsExactly(PlanItemType.PLACE, PlanItemType.MEAL, PlanItemType.LODGING);
    }

    @Test
    @DisplayName("옛 스키마 필드(itemType · title · placeId)를 섞어 써도 무시하고 후보로 채운다 — 산책 코스 아이디 공간이 섞일 자리가 없다")
    void ignoresModelWrittenTypeTitleAndId() {
        // #89 에서 WALK 에 place.id 를 실어 두 아이디 공간이 섞였다. 이제 종류를 모델이 정하지 않는다.
        stubResponse("""
            {"days":[{"day":1,"items":[
              {"place":1,"itemType":"WALK","title":"지어낸 이름","placeId":999,"note":"목줄을 짧게 잡아요."}],"lodging":null}],
             "reasons":[]}
            """);

        AiPlanDraftItem item = adapter.generatePlanDraft(query(candidate(100L, "해안 산책로"))).days().get(0).items().get(0);

        assertThat(item.itemType()).isEqualTo(PlanItemType.PLACE);
        assertThat(item.placeId()).isEqualTo(100L);
        assertThat(item.title()).isEqualTo("해안 산책로");
    }

    @Test
    @DisplayName("번호가 없거나 목록 밖인 항목은 버리고 개수를 남긴다 — 이름을 모델이 쓰지 않으니 남길 것이 없다")
    void dropsItemsWithoutAValidCandidateNumber() {
        ListAppender<ILoggingEvent> appender = attachAppender();
        stubResponse("""
            {"days":[{"day":1,"items":[
              {"place":null,"note":"점심 식사 — 식사 장소가 후보에 없으므로 생략해요."},
              {"place":0,"note":"영"},
              {"place":2,"note":"남는 항목"},
              {"place":3,"note":"목록 밖"}],"lodging":null}],
             "reasons":[]}
            """);

        AiPlanDraft draft = adapter.generatePlanDraft(query(candidate(100L, "오설록"), candidate(200L, "사려니숲길")));

        // 같은 날의 멀쩡한 항목은 남는다 — 한 항목 때문에 초안을 통째로 잃지 않는다
        assertThat(draft.days().get(0).items()).extracting(AiPlanDraftItem::title).containsExactly("사려니숲길");
        assertThat(appender.list).anyMatch(event ->
            event.getFormattedMessage().contains("contained 3 items without a valid candidate number"));
    }

    @Test
    @DisplayName("그날의 lodging 번호를 그날 끝의 숙박 항목으로 펼치고, 마지막 날 숙박은 사실 대조가 뺀다")
    void expandsLodgingNumberIntoTheDayAndFactGuardDropsTheLastNight() {
        stubResponse("""
            {"days":[
              {"day":1,"items":[{"place":1,"note":"바다를 봐요."}],"lodging":3},
              {"day":2,"items":[{"place":2,"note":"실내에서 쉬어요."}],"lodging":3},
              {"day":3,"items":[{"place":4,"note":"그림을 봐요."}],"lodging":3}],
             "reasons":[]}
            """);

        AiPlanDraft draft = adapter.generatePlanDraft(query("2026-09-01", "2026-09-03",
            candidate(100L, "함덕해수욕장"), restaurant(200L, "N109"), lodging(300L, "휘닉스아일랜드콘도"),
            candidate(400L, "제주도립미술관")));

        assertThat(draft.days().get(0).items()).extracting(AiPlanDraftItem::itemType)
            .containsExactly(PlanItemType.PLACE, PlanItemType.LODGING);
        AiPlanDraftItem stay = draft.days().get(0).items().get(1);
        assertThat(stay.placeId()).isEqualTo(300L);
        assertThat(stay.title()).isEqualTo("휘닉스아일랜드콘도");
        // 숙소 메모는 서버 문구다. 사실 대조의 대체 문구와 같은 상수를 쓴다
        assertThat(stay.note()).isEqualTo(AiPlanDraftFactGuard.LODGING_NOTE);
        assertThat(draft.days().get(1).items()).extracting(AiPlanDraftItem::itemType)
            .containsExactly(PlanItemType.MEAL, PlanItemType.LODGING);
        // 마지막 날 숙박을 빼는 규칙은 FactGuard 하나가 갖는다 — 어댑터는 붙였고 FactGuard 가 뺐다
        assertThat(draft.days().get(2).items()).extracting(AiPlanDraftItem::itemType).containsExactly(PlanItemType.PLACE);
    }

    @Test
    @DisplayName("그날 마지막 항목이 이미 같은 숙소면 lodging 을 다시 붙이지 않는다")
    void doesNotDuplicateLodgingAlreadyEndingTheDay() {
        stubResponse("""
            {"days":[
              {"day":1,"items":[{"place":1,"note":"바다를 봐요."},{"place":2,"note":"숙소에서 쉬어요."}],"lodging":2},
              {"day":2,"items":[],"lodging":null}],
             "reasons":[]}
            """);

        AiPlanDraft draft = adapter.generatePlanDraft(query(candidate(100L, "함덕해수욕장"), lodging(200L, "애월 펜션")));

        assertThat(draft.days().get(0).items()).extracting(AiPlanDraftItem::itemType)
            .containsExactly(PlanItemType.PLACE, PlanItemType.LODGING);
        // 남는 것은 모델이 적은 항목이다 — 서버 문구로 바꾸지 않는다
        assertThat(draft.days().get(0).items().get(1).note()).isEqualTo("숙소에서 쉬어요.");
    }

    @Test
    @DisplayName("숙박이 아닌 후보나 목록 밖 번호를 lodging 에 적으면 무시하고 남긴다")
    void ignoresLodgingNumberThatIsNotALodgingCandidate() {
        ListAppender<ILoggingEvent> appender = attachAppender();
        stubResponse("""
            {"days":[
              {"day":1,"items":[{"place":1,"note":"바다를 봐요."}],"lodging":2},
              {"day":2,"items":[{"place":1,"note":"다시 봐요."}],"lodging":9},
              {"day":3,"items":[],"lodging":null}],
             "reasons":[]}
            """);

        AiPlanDraft draft = adapter.generatePlanDraft(query("2026-09-01", "2026-09-03",
            candidate(100L, "함덕해수욕장"), restaurant(200L, "N109")));

        assertThat(draft.days().get(0).items()).extracting(AiPlanDraftItem::itemType).containsExactly(PlanItemType.PLACE);
        assertThat(draft.days().get(1).items()).extracting(AiPlanDraftItem::itemType).containsExactly(PlanItemType.PLACE);
        assertThat(appender.list).anyMatch(event -> event.getFormattedMessage().contains("non-lodging candidate"));
        assertThat(appender.list).anyMatch(event -> event.getFormattedMessage().contains("lodging number is outside"));
    }

    @Test
    @DisplayName("하루 재생성이면 모델이 여러 날을 내도 대상 일자만 남긴다")
    void regenerateKeepsOnlyTheTargetDay() {
        stubResponse("""
            {"days":[
              {"day":1,"items":[{"place":1,"note":"a"}],"lodging":null},
              {"day":2,"items":[{"place":2,"note":"b"}],"lodging":null},
              {"day":3,"items":[{"place":3,"note":"c"}],"lodging":null}],
             "reasons":[]}
            """);

        AiPlanDraft draft = adapter.generatePlanDraft(regenerateQuery(2,
            candidate(100L, "오설록"), candidate(200L, "사려니숲길"), candidate(300L, "협재해수욕장")));

        assertThat(draft.days()).extracting(AiPlanDraft.AiPlanDraftDay::day).containsExactly(2);
        assertThat(draft.days().get(0).items()).extracting(AiPlanDraftItem::title).containsExactly("사려니숲길");
    }

    @Test
    @DisplayName("하루 재생성에서 모델이 하루만 냈는데 번호가 다르면 대상 일자로 바로잡는다")
    void regenerateRenumbersTheSingleReturnedDay() {
        ListAppender<ILoggingEvent> appender = attachAppender();
        stubResponse("""
            {"days":[{"day":1,"items":[{"place":2,"note":"b"}],"lodging":null}],"reasons":[]}
            """);

        AiPlanDraft draft = adapter.generatePlanDraft(regenerateQuery(2, candidate(100L, "오설록"), candidate(200L, "사려니숲길")));

        assertThat(draft.days()).extracting(AiPlanDraft.AiPlanDraftDay::day).containsExactly(2);
        assertThat(draft.days().get(0).items()).extracting(AiPlanDraftItem::title).containsExactly("사려니숲길");
        assertThat(appender.list).anyMatch(event -> event.getFormattedMessage().contains("renumbered"));
    }

    @Test
    @DisplayName("하루 재생성에서 여러 날을 냈는데 대상 일자가 없으면 고를 근거가 없다 — 한 번 다시 부르고, 그래도 없으면 AIPLAN_022 다 (#1268)")
    void regenerateWithoutTheTargetDayFailsAsEmptyPlan() {
        stubResponse("""
            {"days":[
              {"day":1,"items":[{"place":1,"note":"a"}],"lodging":null},
              {"day":3,"items":[{"place":2,"note":"b"}],"lodging":null}],
             "reasons":[]}
            """);

        assertThatThrownBy(() -> adapter.generatePlanDraft(
            regenerateQuery(2, candidate(100L, "오설록"), candidate(200L, "사려니숲길"))))
            .isInstanceOf(AiPlanException.class)
            .extracting(e -> ((AiPlanException) e).getErrorCode())
            .isEqualTo(AiPlanErrorCode.LLM_EMPTY_PLAN);
        verify(ollamaChatModel, times(2)).call(any(Prompt.class));
    }

    @Test
    @DisplayName("근거 이름은 서버가 코드로 채운다 — 모델이 적은 이름은 쓰지 않고, 모르는 코드는 일반 이름이다")
    void fillsReasonNamesFromCodes() {
        stubResponse("""
            {"days":[{"day":1,"items":[{"place":1,"note":"a"}],"lodging":null}],
             "reasons":[
               {"code":"PET_ALLOWED","name":"모델이 지은 이름","description":"모두 동반 가능이에요."},
               {"code":"rest_slot","description":"카페에서 쉬어요."},
               {"code":"CAFE_OK","description":"카페가 있어요."}]}
            """);

        AiPlanDraft draft = adapter.generatePlanDraft(query(candidate(100L, "오설록")));

        assertThat(draft.reasons()).extracting(AiPlanDraftReason::name)
            .containsExactly("반려견 동반 가능", "휴식 시간 확보", "추천 이유");
    }

    @Test
    @DisplayName("근거는 사실 대조 뒤 3개까지만 남긴다 — 확인할 수 없어 빠질 근거가 자리를 차지하지 않는다")
    void keepsAtMostThreeReasonsAfterFactGuard() {
        stubResponse("""
            {"days":[{"day":1,"items":[{"place":1,"note":"a"}],"lodging":null}],
             "reasons":[
               {"code":"SHORT_DISTANCE","description":"이동 거리가 짧아요."},
               {"code":"PET_ALLOWED","description":"모두 동반 가능이에요."},
               {"code":"WEATHER_OK","description":"맑은 날이에요."},
               {"code":"INDOOR_ALTERNATIVE","description":"실내 장소를 넣었어요."},
               {"code":"REST_SLOT","description":"카페에서 쉬어요."}]}
            """);

        AiPlanDraft draft = adapter.generatePlanDraft(query(candidate(100L, "오설록")));

        assertThat(draft.reasons()).extracting(AiPlanDraftReason::code)
            .containsExactly("PET_ALLOWED", "WEATHER_OK", "INDOOR_ALTERNATIVE");
    }

    @Test
    @DisplayName("일정 요청 옵션에 keep-alive 기본값 30m 가 실린다 — 빠진 요청 하나가 서버 기본 5분으로 되돌린다")
    void planRequestCarriesKeepAlive() {
        stubResponse(ONE_ITEM_DRAFT);

        adapter.generatePlanDraft(query(candidate(100L, "오설록")));

        OllamaChatOptions options = sentOptions();
        assertThat(options.getKeepAlive()).isEqualTo("30m");
        assertThat(options.getFormat()).isEqualTo("json");
    }

    @Test
    @DisplayName("준비물 요청 옵션에도 설정한 keep-alive 가 실린다 — 두 호출이 같은 옵션 조립을 쓴다")
    void packingRequestCarriesConfiguredKeepAlive() {
        OllamaLlmAdapter pinned = adapter(new AiLlmProperties(null, null, null, null, null, null, null, null, null, null, null, "-1"));
        stubResponse("""
            {"items":[]}
            """);

        pinned.generatePackingList(PackingChecklistQuery.builder().startDate("2026-09-09").endDate("2026-09-12").build());

        assertThat(sentOptions().getKeepAlive()).isEqualTo("-1");
    }

    @Test
    @DisplayName("마크다운 코드 펜스로 감싼 JSON 도 해석한다 — 로컬 모델이 자주 내는 형태다")
    void toleratesMarkdownFencedJson() {
        stubResponse("""
            ```json
            {"days":[{"day":1,"items":[{"place":1,"note":"a"}]}],"reasons":[]}
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

    @Test
    @DisplayName("파싱 실패 로그에 응답 원문 앞부분과 진단 값이 남는다")
    void logsRawResponseOnParseFailure() {
        // 전에는 예외 메시지만 남겨 모델이 무엇을 돌려줬는지 알 수 없었다. dev 에서
        // AIPLAN_010 을 받고도 원인을 좁힐 수단이 없었던 것이 #232 의 첫 항목이다.
        ListAppender<ILoggingEvent> appender = attachAppender();
        stubResponse("죄송합니다. 일정을 만들어 드리기 전에 몇 가지 여쭙고 싶습니다.");

        assertThatThrownBy(() -> adapter.generatePlanDraft(query(candidate(100L, "장소"))))
            .isInstanceOf(AiPlanException.class);

        String logged = appender.list.stream()
            .map(ILoggingEvent::getFormattedMessage)
            .filter(message -> message.contains("스키마로 해석할 수 없습니다"))
            .findFirst()
            .orElseThrow();
        // 원문이 없으면 "JSON 이 아닌 산문" 과 "잘린 JSON" 과 "스키마가 다른 JSON" 을 가를 수 없다.
        assertThat(logged).contains("죄송합니다");
        // 함께 남는 값들. 이것들이 고칠 곳을 가른다 - 출력 예산인지 입력 잘림인지.
        assertThat(logged).contains("contextTokens=").contains("finishReason=").contains("promptTokens=");
    }

    @Test
    @DisplayName("응답 원문은 앞부분만 남긴다 — 실패가 몰릴 때 로그가 폭발하면 안 된다")
    void truncatesRawResponseInLog() {
        ListAppender<ILoggingEvent> appender = attachAppender();
        stubResponse("가".repeat(5_000));

        assertThatThrownBy(() -> adapter.generatePlanDraft(query(candidate(100L, "장소"))))
            .isInstanceOf(AiPlanException.class);

        String logged = appender.list.stream()
            .map(ILoggingEvent::getFormattedMessage)
            .filter(message -> message.contains("스키마로 해석할 수 없습니다"))
            .findFirst()
            .orElseThrow();
        assertThat(logged).contains("...(truncated)");
        // 원문 5,000자가 그대로 실리지 않는다. 원문과 파서 메시지를 각각 500자로 끊으므로
        // 라벨을 더해도 한 줄이 2,000자를 넘지 않는다.
        assertThat(logged.length()).isLessThan(2_000);
        // 잘렸어도 얼마나 길었는지는 알 수 있어야 한다.
        assertThat(logged).contains("textLength=5000");
    }

    @Test
    @DisplayName("읽기 타임아웃은 AIPLAN_020 으로 가른다 — 연결 불가와 할 말이 다르다")
    void readTimeoutIsItsOwnCode() {
        // dev 에서 두 번 실패했는데 코드가 서로 달랐고(AIPLAN_007 / AIPLAN_010) 원인을 좁힐
        // 수 없었다(#232). 타임아웃은 "잠시 후 다시" 가 아니라 "조건을 줄여 보세요" 다.
        when(ollamaChatModel.call(any(Prompt.class)))
            .thenThrow(new IllegalStateException("I/O error", new SocketTimeoutException("Read timed out")));

        assertThatThrownBy(() -> adapter.generatePlanDraft(query(candidate(100L, "장소"))))
            .isInstanceOf(AiPlanException.class)
            .extracting(e -> ((AiPlanException) e).getErrorCode())
            .isEqualTo(AiPlanErrorCode.LLM_TIMEOUT);
    }

    @Test
    @DisplayName("타임아웃 판정은 원인 사슬을 훑는다 — 최상위 타입만 보면 놓친다")
    void findsTimeoutDeepInTheCauseChain() {
        // RestClient 가 ResourceAccessException 으로 감싸고 그 안에 SocketTimeoutException 이
        // 들어 있다. 실제 사슬은 여기보다 한두 겹 더 깊다.
        when(ollamaChatModel.call(any(Prompt.class))).thenThrow(new IllegalStateException("outer",
            new IllegalStateException("middle", new SocketTimeoutException("Read timed out"))));

        assertThatThrownBy(() -> adapter.generatePlanDraft(query(candidate(100L, "장소"))))
            .extracting(e -> ((AiPlanException) e).getErrorCode())
            .isEqualTo(AiPlanErrorCode.LLM_TIMEOUT);
    }

    @Test
    @DisplayName("준비물 이유에 새어 든 프롬프트 표기 [N일차] 를 걷어낸다 — 그 문장이 화면의 본문이다 (#233)")
    void cleansPromptMarkersLeakedIntoPackingReasons() {
        // 목록 안의 조건부 품목이어야 서버 규칙(#976)을 지나 이유가 화면까지 간다.
        stubResponse("""
            {"items":[
              {"category":"반려견 케어","name":"물티슈","reason":"[4일차] 2026-09-12 해변 일정 뒤 발을 닦아요."},
              {"category":"이동 중","name":"이동장","reason":"[1일차]~[3일차] 차로 옮겨 다녀요."}]}
            """);

        PackingList packing = adapter.generatePackingList(PackingChecklistQuery.builder()
            .startDate("2026-09-09").endDate("2026-09-12").build());

        assertThat(packing.items())
            .filteredOn(item -> item.name().equals("물티슈") || item.name().equals("이동장"))
            .extracting(PackingList.PackingItem::reason).containsExactly(
                "4일차 2026-09-12 해변 일정 뒤 발을 닦아요.",
                "1~3일차 차로 옮겨 다녀요.");
    }

    @Test
    @DisplayName("일정 근거와 항목 메모도 같은 정리를 거친다 — 같은 프롬프트 팩토리를 쓰므로 같은 표기가 샌다")
    void cleansPromptMarkersLeakedIntoDraftReasonsAndNotes() {
        stubResponse("""
            {"days":[{"day":1,"items":[{"place":1,"note":"[1일차] 비 예보라 실내"}],"lodging":null}],
             "reasons":[{"code":"WEATHER_OK","description":"[2일차]~[3일차] 강수확률 80%라 실내 위주"}]}
            """);

        AiPlanDraft draft = adapter.generatePlanDraft(query(candidate(100L, "오설록")));

        assertThat(draft.days().get(0).items().get(0).note()).isEqualTo("1일차 비 예보라 실내");
        // 이름은 모델이 쓰지 않는다 — 코드표의 이름이라 정리할 표기가 없다
        assertThat(draft.reasons().get(0).name()).isEqualTo("날씨 양호");
        assertThat(draft.reasons().get(0).description()).isEqualTo("2~3일차 강수확률 80%라 실내 위주");
    }

    /*
     * #570. 조사 교정이 `note`·`reason` 에 **실제로 걸려 있는지** 본다. 단위 테스트
     * (`KoreanParticleFixerTest`)만으로는 `cleanUserFacing` 호출 한 줄이 빠져도 초록이다.
     */
    @Test
    @DisplayName("장소명 뒤에 잘못 붙은 조사를 근거·메모에서 바로잡는다 (#570)")
    void fixesParticlesAfterCandidateTitles() {
        stubResponse("""
            {"days":[{"day":1,"items":[{"place":1,"note":"제주 애월코스트34은 바다 앞이에요"}],"lodging":null}],
             "reasons":[{"code":"PET_ALLOWED","description":"제주 애월코스트34은 소형견만 가능해요"}]}
            """);

        AiPlanDraft draft = adapter.generatePlanDraft(query(candidate(100L, "제주 애월코스트34")));

        assertThat(draft.days().get(0).items().get(0).note()).isEqualTo("제주 애월코스트34는 바다 앞이에요");
        assertThat(draft.reasons().get(0).description()).isEqualTo("제주 애월코스트34는 소형견만 가능해요");
    }

    @Test
    @DisplayName("같은 장소가 여러 날에 걸치면 경고를 남긴다 (#570)")
    void warnsWhenTheSamePlaceRepeatsAcrossDays() {
        ListAppender<ILoggingEvent> appender = attachAppender();
        stubResponse("""
            {"days":[
              {"day":1,"items":[{"place":1,"note":"산책"}],"lodging":null},
              {"day":2,"items":[{"place":1,"note":"또 산책"}],"lodging":null}],
             "reasons":[]}
            """);

        adapter.generatePlanDraft(query(candidate(100L, "애월한담공원")));

        assertThat(appender.list).anyMatch(event ->
            event.getFormattedMessage().contains("same place on multiple days")
                && event.getFormattedMessage().contains("애월한담공원"));
    }

    /*
     * **숙소 제외가 깨지면 정상적인 2박 일정마다 경고가 남는다.** 그러면 이 로그를 "재발을 세는
     * 자리" 로 쓰겠다는 설계가 바로 무력해진다 — 그래서 참·거짓 양쪽을 다 밟아 둔다.
     * 규칙을 어기고 숙소를 항목에 적어도 종류는 후보 분류로 LODGING 이라 세지 않는다.
     */
    @Test
    @DisplayName("같은 숙소에 이어 묵는 것은 경고하지 않는다 (#570)")
    void doesNotWarnWhenTheSameLodgingRepeats() {
        ListAppender<ILoggingEvent> appender = attachAppender();
        stubResponse("""
            {"days":[
              {"day":1,"items":[{"place":2,"note":"산책"},{"place":1,"note":"숙박"}],"lodging":1},
              {"day":2,"items":[{"place":1,"note":"숙박"}],"lodging":null}],
             "reasons":[]}
            """);

        adapter.generatePlanDraft(query(lodging(100L, "제주 애월코스트34"), candidate(200L, "애월한담공원")));

        assertThat(appender.list).noneMatch(event ->
            event.getFormattedMessage().contains("same place on multiple days"));
    }

    @Test
    @DisplayName("성공한 호출도 소요를 남긴다 — 전에는 실패했을 때만 남아 느린 정상 경로를 볼 수 없었다 (#489)")
    void logsTimingOnSuccess() {
        ListAppender<ILoggingEvent> appender = attachAppender();
        stubResponse(ONE_ITEM_DRAFT);

        adapter.generatePlanDraft(query(candidate(100L, "오설록")));

        String logged = timingLog(appender);
        assertThat(logged).contains("operation=plan");
        assertThat(logged).contains("promptChars=");
        assertThat(logged).contains("elapsedMs=");
    }

    @Test
    @DisplayName("Ollama 지표를 밀리초로 갈라 남긴다 — 프리필과 디코드를 구분해야 무엇을 줄일지 정한다")
    void splitsPrefillAndDecode() {
        ListAppender<ILoggingEvent> appender = attachAppender();
        // 프리필 8.2초 · 디코드 56.8초 (dev 실측 63~71초의 모양)
        stubResponseWithOllamaTiming(ONE_ITEM_DRAFT, 8_200_000_000L, 56_800_000_000L);

        adapter.generatePlanDraft(query(candidate(100L, "오설록")));

        String logged = timingLog(appender);
        assertThat(logged).contains("prefillMs=8200");
        assertThat(logged).contains("decodeMs=56800");
        assertThat(logged).contains("totalMs=65000");
        // 모델이 이미 올라와 있으면 0 이다. 0 이 아니면 keep-alive 를 의심할 신호라 지우지 않는다.
        assertThat(logged).contains("loadMs=0");
        assertThat(logged).contains("outputTokens=820");
        // 전체 - 로드 - 디코드 (#1246) — 보고된 prefillMs 가 긴 입력에서 틀려서 함께 남긴다
        assertThat(logged).contains("prefillEstMs=8200");
    }

    @Test
    @DisplayName("보고된 prefill 이 틀려도 전체에서 로드 · 디코드를 뺀 값이 실제 입력 처리 시간으로 남는다 (#1246)")
    void estimatesPrefillWhenReportedValueIsWrong() {
        ListAppender<ILoggingEvent> appender = attachAppender();
        // dev 실측 모양 (2026-10-08 3일 1회차): total 95.4초 · load 8.4초 · 보고 prefill 64ms · decode 18.2초
        ChatResponseMetadata metadata = ChatResponseMetadata.builder()
            .keyValue("total-duration", Duration.ofMillis(95_376))
            .keyValue("load-duration", Duration.ofMillis(8_404))
            .keyValue("prompt-eval-duration", Duration.ofMillis(64))
            .keyValue("eval-duration", Duration.ofMillis(18_179))
            .usage(new DefaultUsage(5644, 342))
            .build();
        when(ollamaChatModel.call(any(Prompt.class)))
            .thenReturn(new ChatResponse(List.of(new Generation(new AssistantMessage(ONE_ITEM_DRAFT))), metadata));

        adapter.generatePlanDraft(query(candidate(100L, "오설록")));

        assertThat(timingLog(appender)).contains("prefillMs=64").contains("prefillEstMs=68793");
    }

    /*
     * #1235. 위 테스트가 전에는 나노초 Long 을 넣어 통과했는데, Spring AI 1.1.8 의 OllamaChatModel 은 Duration 을
     * 싣는다 — dev 에서 단계별 시간이 전부 null 이었다. 가짜 응답은 이제 Duration 이고, 숫자는 호환 경로로만 본다.
     */
    @Test
    @DisplayName("나노초 숫자로 온 지표도 읽는다 — 다른 버전 호환 (#1235)")
    void readsNumericNanosForCompatibility() {
        ListAppender<ILoggingEvent> appender = attachAppender();
        ChatResponseMetadata metadata = ChatResponseMetadata.builder()
            .keyValue("total-duration", 3_000_000_000L)
            .keyValue("load-duration", 1_500_000_000L)
            .keyValue("prompt-eval-duration", 500_000_000L)
            .keyValue("eval-duration", 1_000_000_000L)
            .usage(new DefaultUsage(100, 10))
            .build();
        when(ollamaChatModel.call(any(Prompt.class)))
            .thenReturn(new ChatResponse(List.of(new Generation(new AssistantMessage(ONE_ITEM_DRAFT))), metadata));

        adapter.generatePlanDraft(query(candidate(100L, "오설록")));

        String logged = timingLog(appender);
        assertThat(logged).contains("totalMs=3000").contains("loadMs=1500")
            .contains("prefillMs=500").contains("decodeMs=1000").contains("prefillEstMs=500");
    }

    @Test
    @DisplayName("지표가 없는 응답에도 계측이 생성을 막지 않는다 — provider 를 바꾸면 이 키들이 없다")
    void toleratesMissingTimingMetadata() {
        ListAppender<ILoggingEvent> appender = attachAppender();
        stubResponse(ONE_ITEM_DRAFT);

        // 던지지 않는 것이 요점이다
        assertThat(adapter.generatePlanDraft(query(candidate(100L, "오설록"))).days()).hasSize(1);
        assertThat(timingLog(appender)).contains("prefillMs=null").contains("decodeMs=null").contains("prefillEstMs=null");
    }

    /*
     * #975 의 dev 실측을 새 스키마로 옮긴 고정 입력이다 (2026-10-07 ~ 10-08, 16~23℃). 모델은 요약에 이동 거리를
     * 지어 적었고, 2일차에도 숙박을 넣었고, 콘도를 해안 산책 장소라고 설명했다.
     */
    @Test
    @DisplayName("dev 실측 초안 — 마지막 날 숙박 0건, 거리 · 더위 근거 제거, 콘도는 숙박이다 (#975)")
    void correctsDevDraftAgainstServerFacts() {
        stubResponse("""
            {"days":[
              {"day":1,"items":[{"place":1,"note":"오전에 바다를 보며 걸어요."}],"lodging":2},
              {"day":2,"items":[
                {"place":2,"note":"해안가에서 가벼운 산책을 할 수 있는 실외 장소예요."},
                {"place":3,"note":"실내 카페에서 쉬어요."}],"lodging":2}],
             "reasons":[
               {"code":"SHORT_DISTANCE","description":"각 일정 간 이동 거리가 짧아 반려견이 덜 지쳐요."},
               {"code":"WEATHER_OK","description":"맑은 날이에요. 한낮의 더위를 피할 수 있어요."},
               {"code":"PET_ALLOWED","description":"모든 장소가 반려견 동반 가능이에요."}]}
            """);
        AiPlanGenerationQuery query = AiPlanGenerationQuery.builder()
            .areaCode("39")
            .startDate("2026-10-07")
            .endDate("2026-10-08")
            .weatherOutlook(List.of(
                mildDay(LocalDate.of(2026, 10, 7)), mildDay(LocalDate.of(2026, 10, 8))))
            .placeCandidates(List.of(
                new PlaceCandidate(300L, "함덕해수욕장", "관광지", "제주시 조천읍", "동반 가능", null, null, false, "해수욕장", 33.54, 126.67),
                lodging(200L, "휘닉스아일랜드콘도"),
                restaurant(400L, "N109")))
            .build();

        AiPlanDraft draft = adapter.generatePlanDraft(query);

        List<AiPlanDraftItem> lastDay = draft.days().get(1).items();
        assertThat(lastDay).extracting(AiPlanDraftItem::itemType).doesNotContain(PlanItemType.LODGING);
        assertThat(lastDay).extracting(AiPlanDraftItem::title).containsExactly("N109");
        assertThat(draft.days().get(0).items()).extracting(AiPlanDraftItem::itemType)
            .containsExactly(PlanItemType.PLACE, PlanItemType.LODGING);
        assertThat(draft.reasons()).extracting(AiPlanDraftReason::code)
            .containsExactly("WEATHER_OK", "PET_ALLOWED");
        assertThat(draft.reasons().get(0).description()).isEqualTo("맑은 날이에요.");
    }

    @Test
    @DisplayName("모든 날이 비면 한 번 다시 부르고 채워진 쪽을 낸다 — 빈 날과 원문 앞부분을 남긴다 (#1268)")
    void retriesOnceWhenEveryDayIsEmpty() {
        ListAppender<ILoggingEvent> appender = attachAppender();
        when(ollamaChatModel.call(any(Prompt.class))).thenReturn(
            response("""
                {"days":[{"day":1,"items":[],"lodging":null},{"day":2,"items":[],"lodging":null}],"reasons":[]}
                """),
            response("""
                {"days":[{"day":1,"items":[{"place":1,"note":"a"}],"lodging":null},
                         {"day":2,"items":[{"place":2,"note":"b"}],"lodging":null}],"reasons":[]}
                """));

        AiPlanDraft draft = adapter.generatePlanDraft(query(candidate(100L, "오설록"), restaurant(200L, "N109")));

        assertThat(draft.days()).extracting(day -> day.items().get(0).title()).containsExactly("오설록", "N109");
        verify(ollamaChatModel, times(2)).call(any(Prompt.class));
        assertThat(appender.list).anyMatch(event -> event.getFormattedMessage()
            .contains("attempt=1 emptyDays=[1, 2] of=2")
            && event.getFormattedMessage().contains("rawHead={\"days\""));
    }

    @Test
    @DisplayName("다시 불러도 방문할 곳이 하루도 없으면 AIPLAN_022 다 — 숙소만 있는 초안도 빈 초안이다 (#1268)")
    void failsAsEmptyPlanWhenTheRetryIsEmptyToo() {
        when(ollamaChatModel.call(any(Prompt.class))).thenReturn(
            response("""
                {"days":[{"day":1,"items":[],"lodging":1},{"day":2,"items":[],"lodging":null}],"reasons":[]}
                """),
            response("""
                {"days":[],"reasons":[{"code":"PET_ALLOWED","description":"모두 동반 가능이에요."}]}
                """));

        assertThatThrownBy(() -> adapter.generatePlanDraft(query(lodging(100L, "제주 애월코스트34"))))
            .isInstanceOf(AiPlanException.class)
            .extracting(e -> ((AiPlanException) e).getErrorCode())
            .isEqualTo(AiPlanErrorCode.LLM_EMPTY_PLAN);
        verify(ollamaChatModel, times(2)).call(any(Prompt.class));
    }

    @Test
    @DisplayName("일부 날만 비면 다시 부르지 않고 그대로 낸다 — 빈 날은 화면이 안내하고 로그에 남긴다 (#1268)")
    void keepsDraftWithSomeEmptyDaysWithoutRetry() {
        ListAppender<ILoggingEvent> appender = attachAppender();
        stubResponse("""
            {"days":[{"day":1,"items":[{"place":1,"note":"a"}],"lodging":null},{"day":2,"items":[],"lodging":null}],
             "reasons":[]}
            """);

        AiPlanDraft draft = adapter.generatePlanDraft(query(candidate(100L, "오설록")));

        assertThat(draft.days()).hasSize(2);
        verify(ollamaChatModel).call(any(Prompt.class));
        assertThat(appender.list).anyMatch(event ->
            event.getFormattedMessage().contains("attempt=1 emptyDays=[2] of=2"));
    }

    private static ChatResponse response(String text) {
        return new ChatResponse(List.of(new Generation(new AssistantMessage(text))));
    }

    private static final String ONE_ITEM_DRAFT = """
        {"days":[{"day":1,"items":[{"place":1,"note":"실내"}],"lodging":null}],"reasons":[]}
        """;

    private OllamaLlmAdapter adapter(AiLlmProperties properties) {
        return new OllamaLlmAdapter(
            ollamaChatModel, new AiPlanPromptFactory(), properties, CircuitBreakerRegistry.ofDefaults(),
            new LlmCallGate(properties));
    }

    private static AiLlmProperties defaultProperties() {
        return new AiLlmProperties(null, null, null, null, null, null, null, null, null, null, null, null);
    }

    /** 모델에 실제로 보낸 요청 옵션. 어댑터가 Prompt 에 실은 OllamaChatOptions 그대로다. */
    private OllamaChatOptions sentOptions() {
        ArgumentCaptor<Prompt> captor = ArgumentCaptor.forClass(Prompt.class);
        verify(ollamaChatModel).call(captor.capture());
        return (OllamaChatOptions) captor.getValue().getOptions();
    }

    private String timingLog(ListAppender<ILoggingEvent> appender) {
        return appender.list.stream()
            .map(ILoggingEvent::getFormattedMessage)
            .filter(message -> message.startsWith("LLM timing"))
            .findFirst()
            .orElseThrow();
    }

    /** 어댑터 로거에 붙여 남은 로그를 읽는다. 파싱 실패의 진단 값이 실제로 남는지 보려면 이 방법뿐이다. */
    private ListAppender<ILoggingEvent> attachAppender() {
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        ((Logger) LoggerFactory.getLogger(OllamaLlmAdapter.class)).addAppender(appender);
        return appender;
    }

    /**
     * Spring AI 의 OllamaChatModel 이 싣는 지표를 그대로 흉내 낸 응답. 계측이 그것을 읽는지 본다 (#489).
     *
     * <p><b>값은 {@link Duration} 이다</b> — Spring AI 1.1.8 이 Ollama 의 나노초를 Duration 으로 바꿔 싣는다. 전에 이
     * 자리에 나노초 Long 을 넣어 테스트는 통과하고 dev 에서는 전부 null 이었다 (#1235).
     */
    private void stubResponseWithOllamaTiming(String text, long promptEvalNanos, long evalNanos) {
        ChatResponseMetadata metadata = ChatResponseMetadata.builder()
            .keyValue("total-duration", Duration.ofNanos(promptEvalNanos + evalNanos))
            .keyValue("load-duration", Duration.ZERO)
            .keyValue("prompt-eval-duration", Duration.ofNanos(promptEvalNanos))
            .keyValue("eval-duration", Duration.ofNanos(evalNanos))
            .usage(new DefaultUsage(7400, 820))
            .build();
        when(ollamaChatModel.call(any(Prompt.class)))
            .thenReturn(new ChatResponse(List.of(new Generation(new AssistantMessage(text))), metadata));
    }

    private DayWeatherOutlook mildDay(LocalDate date) {
        return DayWeatherOutlook.builder().date(date).skyStateName("맑음")
            .maxPrecipitationProbability(10).minTemperature(16.0).maxTemperature(23.0).build();
    }

    private void stubResponse(String text) {
        when(ollamaChatModel.call(any(Prompt.class)))
            .thenReturn(new ChatResponse(List.of(new Generation(new AssistantMessage(text)))));
    }

    private AiPlanGenerationQuery query(PlaceCandidate... candidates) {
        return query("2026-09-01", "2026-09-02", candidates);
    }

    private AiPlanGenerationQuery query(String startDate, String endDate, PlaceCandidate... candidates) {
        return AiPlanGenerationQuery.builder()
            .areaCode("39")
            .startDate(startDate)
            .endDate(endDate)
            .placeCandidates(List.of(candidates))
            .build();
    }

    /** 3일 일정의 하루 재생성. 워커처럼 regenerateDay 와 planOutline 을 함께 채운다. */
    private AiPlanGenerationQuery regenerateQuery(int regenerateDay, PlaceCandidate... candidates) {
        return AiPlanGenerationQuery.builder()
            .areaCode("39")
            .startDate("2026-09-01")
            .endDate("2026-09-03")
            .regenerateDay(regenerateDay)
            .planOutline(PlanOutline.builder().planId(7L).days(List.of(
                PlanOutline.PlanOutlineDay.builder().day(1).items(List.of()).build(),
                PlanOutline.PlanOutlineDay.builder().day(2).items(List.of()).build(),
                PlanOutline.PlanOutlineDay.builder().day(3).items(List.of()).build())).build())
            .placeCandidates(List.of(candidates))
            .build();
    }

    private PlaceCandidate candidate(long placeId, String title) {
        return new PlaceCandidate(placeId, title, "관광지", "제주특별자치도", "동반 가능", null, null, true, "여행지", 33.5, 126.5);
    }

    private PlaceCandidate lodging(long placeId, String title) {
        return new PlaceCandidate(placeId, title, "숙박", "제주특별자치도", "동반 가능", null, null, true, "펜션", 33.5, 126.5);
    }

    private PlaceCandidate restaurant(long placeId, String title) {
        return new PlaceCandidate(placeId, title, "음식점", "제주시 구좌읍", "동반 가능", null, null, true, "카페", 33.55, 126.75);
    }
}
