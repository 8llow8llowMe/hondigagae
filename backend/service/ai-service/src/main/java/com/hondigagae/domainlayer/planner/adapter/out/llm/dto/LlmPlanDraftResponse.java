package com.hondigagae.domainlayer.planner.adapter.out.llm.dto;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import java.util.List;

/**
 * LLM 구조화 출력 스키마.
 *
 * <p>SDK 가 이 record 에서 JSON 스키마를 유도해 모델 응답을 강제하므로, 문자열을 정규식으로
 * 뜯어 파싱하는 일이 없다. <b>스키마 자체가 계약이고, 필드 설명이 곧 지시문이다</b> -
 * 그래서 {@code @JsonPropertyDescription} 에 규칙을 적는다. 프롬프트 본문에 같은 말을 또 적으면
 * 두 곳이 갈라진다.
 *
 * <p><b>모델은 서버가 이미 아는 것을 쓰지 않는다</b> (#1128). dev(gpt-oss:20b) 디코드가 18.6 tok/s 고정이라
 * 출력 토큰이 곧 대기 시간인데, 옛 스키마는 종류 · 이름 · 18자리 아이디를 항목마다 다시 쓰게 했다 — 이름은
 * 어차피 서버가 후보 이름으로 덮어쓰고, 종류는 후보 분류로 정해진다. 그래서 모델은 <b>후보 번호와 메모만</b>
 * 적고, 숙소는 항목이 아니라 그날의 {@code lodging} 번호 하나로 적는다. 나머지는 {@code OllamaLlmAdapter} 가
 * 후보에서 채운다. 설명도 짧게 둔다 — 이 스키마는 요청마다 프롬프트에 실린다.
 *
 * <p>{@code @JsonPropertyOrder} 는 스키마의 속성 순서다(Spring AI 가 따른다). 모델은 스키마 순서대로 쓰므로
 * 번호를 먼저 정하고 그 장소의 메모를 쓰게 한다 — 지정하지 않으면 알파벳순이라 메모가 장소보다 앞선다.
 *
 * <p>이 타입은 adapter 안에만 있는다. application 계층은 {@code AiPlanDraft}(domain model)만 안다
 * (architecture-guide §3).
 */
@JsonPropertyOrder({"days", "reasons"})
public record LlmPlanDraftResponse(

    @JsonPropertyDescription("일자별 일정. day 는 1부터.")
    List<LlmPlanDay> days,

    @JsonPropertyDescription("이렇게 짠 근거. 최대 3개.")
    List<LlmPlanReason> reasons
) {

    @JsonPropertyOrder({"day", "items", "lodging"})
    public record LlmPlanDay(

        @JsonPropertyDescription("몇째 날인지. 1부터.")
        int day,

        @JsonPropertyDescription("그날 들를 곳. 시간 순서. 숙박은 넣지 않는다.")
        List<LlmPlanItem> items,

        @JsonPropertyDescription("그날 밤 묵을 숙박 후보 번호. 마지막 날이거나 없으면 null.")
        Integer lodging
    ) {

    }

    @JsonPropertyOrder({"place", "note"})
    public record LlmPlanItem(

        @JsonPropertyDescription("후보 목록의 번호.")
        Integer place,

        @JsonPropertyDescription("반려견 관점의 메모 한 문장. 25자 안팎.")
        String note
    ) {

    }

    @JsonPropertyOrder({"code", "description"})
    public record LlmPlanReason(

        @JsonPropertyDescription("PET_ALLOWED, WEATHER_OK, INDOOR_ALTERNATIVE, REST_SLOT 중 하나.")
        String code,

        @JsonPropertyDescription("후보 데이터의 구체적인 사실을 담은 한 문장.")
        String description
    ) {

    }
}
