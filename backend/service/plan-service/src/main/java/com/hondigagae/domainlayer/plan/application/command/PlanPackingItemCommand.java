package com.hondigagae.domainlayer.plan.application.command;

import lombok.Builder;

/**
 * 준비물 항목 저장 커맨드.
 *
 * <p>{@code sortOrder} 와 {@code source} 는 받지 않는다 — 순서는 중복을 걸러낸 뒤 Processor 가
 * 0부터 다시 매기고, 출처는 경로가 결정한다(교체는 AI, 직접 추가는 USER). 클라이언트가 정할 수
 * 있게 두면 사용자 항목이 AI 로 저장돼 다음 재생성에 조용히 지워진다.
 *
 * @param reason 직접 추가 경로에서는 항상 null 이다 — 이유는 이 여행 데이터를 읽은 AI 만 붙일 수 있다
 */
@Builder
public record PlanPackingItemCommand(
    String category,
    String name,
    String reason
) {

}
