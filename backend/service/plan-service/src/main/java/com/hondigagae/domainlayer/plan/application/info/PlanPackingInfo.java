package com.hondigagae.domainlayer.plan.application.info;

import java.time.LocalDateTime;
import java.util.List;
import lombok.Builder;

/**
 * 일정의 준비물 목록.
 *
 * @param generatedAt AI 항목 중 가장 늦은 저장 시각. AI 항목이 하나도 없으면 null 이다.
 *                    Presenter 가 아니라 Processor 가 계산해 담는다 — Presenter 는 변환만 한다
 *                    (architecture-guide §3)
 */
@Builder
public record PlanPackingInfo(
    long planId,
    List<PlanPackingItemInfo> items,
    int totalCount,
    int checkedCount,
    LocalDateTime generatedAt
) {

}
