package com.hondigagae.domainlayer.planner.domain.model;

import java.util.List;
import lombok.Builder;

/**
 * LLM이 생성한 반려견 여행 준비물 목록(domain model).
 *
 * <p>일정 초안({@link AiPlanDraft})과 같은 지위다 — 제안일 뿐 저장하지 않으며,
 * {@code AiLlmPort} 반환 타입이라 application 계층 타입(Info)을 쓰지 않는다.
 */
@Builder
public record PackingList(
    List<PackingItem> items
) {

    public List<PackingItem> safeItems() {
        return items == null ? List.of() : items;
    }

    /**
     * 준비물 한 가지. reason 은 XAI 규약(api-design-guide §9)대로 일반론이 아니라
     * 이 여행의 데이터(예보·반려견 특성·일정 구성)에 근거한 사실이어야 한다.
     */
    @Builder
    public record PackingItem(
        String category,
        String name,
        String reason
    ) {

    }
}
