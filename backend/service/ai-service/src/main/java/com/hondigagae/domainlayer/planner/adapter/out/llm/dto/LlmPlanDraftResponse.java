package com.hondigagae.domainlayer.planner.adapter.out.llm.dto;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import java.util.List;

/**
 * LLM 구조화 출력 스키마.
 *
 * <p>SDK 가 이 record 에서 JSON 스키마를 유도해 모델 응답을 강제하므로, 문자열을 정규식으로
 * 뜯어 파싱하는 일이 없다. <b>스키마 자체가 계약이고, 필드 설명이 곧 지시문이다</b> -
 * 그래서 {@code @JsonPropertyDescription} 에 규칙을 적는다. 프롬프트 본문에 같은 말을 또 적으면
 * 두 곳이 갈라진다.
 *
 * <p>이 타입은 adapter 안에만 있는다. application 계층은 {@code AiPlanDraft}(domain model)만 안다
 * (architecture-guide §3).
 */
public record LlmPlanDraftResponse(

    @JsonPropertyDescription("일자별 일정. day 는 1부터 시작하며 여행 일수만큼 있어야 한다.")
    List<LlmPlanDay> days,

    @JsonPropertyDescription(
        "이 일정을 이렇게 짠 이유. 반드시 제공된 후보 장소 데이터에 근거해야 하며, "
            + "일반론이 아니라 구체적인 사실을 담는다.")
    List<LlmPlanReason> reasons
) {

    public record LlmPlanDay(

        @JsonPropertyDescription("몇째 날인지. 1부터 시작한다.")
        int day,

        @JsonPropertyDescription("그날의 일정 항목. 시간 순서대로 담는다.")
        List<LlmPlanItem> items
    ) {

    }

    public record LlmPlanItem(

        @JsonPropertyDescription(
            "항목 종류. PLACE(장소), MEAL(식사), LODGING(숙박), MOVE(이동) 중 하나만 쓴다. "
            + "산책은 종류가 아니라 그 장소에서 하는 일이므로 PLACE 로 적고 title 과 note 에 적는다.")
        String itemType,

        @JsonPropertyDescription(
            "후보 장소 목록에 있는 placeId 를 그대로 적는다. 목록에 없는 장소는 절대 만들어 내지 않는다. "
            + "MOVE 처럼 특정 장소가 없는 항목만 null 로 둔다.")
        Long placeId,

        @JsonPropertyDescription("항목 이름. placeId 가 있으면 후보 목록의 장소명과 같아야 한다.")
        String title,

        @JsonPropertyDescription("이 항목을 넣은 이유나 주의점을 한 문장으로. 반려견 관점에서 쓴다.")
        String note
    ) {

    }

    public record LlmPlanReason(

        @JsonPropertyDescription(
            "근거 코드. PET_ALLOWED, WEATHER_OK, LOW_CONGESTION, INDOOR_ALTERNATIVE, "
                + "SHORT_DISTANCE, REST_SLOT 중에서 고른다.")
        String code,

        @JsonPropertyDescription("근거 이름. 화면에 그대로 보여 줄 짧은 한국어 표현.")
        String name,

        @JsonPropertyDescription("근거 설명. 후보 데이터의 구체적인 사실을 담은 한 문장.")
        String description
    ) {

    }
}
