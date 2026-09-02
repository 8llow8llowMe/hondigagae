package com.hondigagae.domainlayer.planner.adapter.out.llm.dto;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import java.util.List;

/**
 * 준비물 목록의 LLM 구조화 출력 스키마. {@code LlmPlanDraftResponse} 와 같은 방침 —
 * 필드 설명이 곧 지시문이고, 이 타입은 adapter 안에만 있는다.
 */
public record LlmPackingListResponse(

    @JsonPropertyDescription(
        "반려견 여행 준비물 목록. 8~15개로 만들고, 제공된 예보·반려견 특성·일정 구성에서 "
            + "근거를 찾을 수 있는 것을 우선한다.")
    List<LlmPackingItem> items
) {

    public record LlmPackingItem(

        @JsonPropertyDescription("분류. 필수/날씨 대비/반려견 케어/이동 중 하나만 쓴다.")
        String category,

        @JsonPropertyDescription("준비물 이름. 짧은 명사구로 쓴다. 예: 휴대용 물그릇")
        String name,

        @JsonPropertyDescription(
            "왜 필요한지. 반드시 제공된 데이터(그날 예보, 반려견 특성, 일정 항목)에 근거한 "
                + "구체적 사실을 담고, 근거가 없으면 일반 필수품으로만 분류한다.")
        String reason
    ) {

    }
}
