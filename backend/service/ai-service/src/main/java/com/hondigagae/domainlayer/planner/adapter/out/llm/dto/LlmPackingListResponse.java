package com.hondigagae.domainlayer.planner.adapter.out.llm.dto;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import java.util.List;

/**
 * 준비물 목록의 LLM 구조화 출력 스키마. {@code LlmPlanDraftResponse} 와 같은 방침 —
 * 필드 설명이 곧 지시문이고, 이 타입은 adapter 안에만 있는다.
 */
public record LlmPackingListResponse(

    @JsonPropertyDescription(
        "서버가 넣는 기본 품목과 날씨 품목을 뺀 반려견 여행 준비물 목록. 0~8개로 만들고, "
            + "제공된 반려견 특성·일정 구성에서 근거를 찾을 수 있는 것만 담는다.")
    List<LlmPackingItem> items
) {

    public record LlmPackingItem(

        @JsonPropertyDescription("분류. 반려견 케어/이동 중 하나만 쓴다. 필수와 날씨 대비는 서버가 채운다.")
        String category,

        @JsonPropertyDescription("준비물 이름. 실제로 파는 반려견 여행 용품의 짧은 명사구로 쓴다. 예: 물티슈, 이동장")
        String name,

        @JsonPropertyDescription(
            "왜 필요한지. 반드시 제공된 데이터(반려견 특성, 일정 항목, 그날 예보)에 근거한 구체적 사실을 담는다. "
                + "근거를 찾을 수 없는 물건은 넣지 않는다.")
        String reason
    ) {

    }
}
