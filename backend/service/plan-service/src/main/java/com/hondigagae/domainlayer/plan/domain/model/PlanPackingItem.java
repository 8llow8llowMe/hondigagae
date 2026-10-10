package com.hondigagae.domainlayer.plan.domain.model;

import com.hondigagae.domainlayer.plan.domain.enums.PackingItemSource;
import java.time.LocalDateTime;
import lombok.Builder;

/**
 * 여행 준비물 항목.
 *
 * @param createdAt 저장 시각. AI 항목 중 가장 늦은 값이 목록 응답의 {@code generatedAt} 이 된다 —
 *                  매번 다른 결과가 나오는 기능이라 "이 목록이 언제 뽑힌 것인가" 를 답할 수 있어야 한다.
 *                  아직 저장되지 않은 항목은 null 이다
 */
@Builder(toBuilder = true)
public record PlanPackingItem(
    long id,
    long planId,
    String category,
    String name,
    String reason,
    PackingItemSource source,
    boolean checked,
    int sortOrder,
    LocalDateTime createdAt
) {

    public PlanPackingItem withChecked(boolean checked) {
        return toBuilder().checked(checked).build();
    }

    /** 표시 순서만 바꾼다 — AI 교체 후 사용자 항목을 뒤로 다시 매길 때 내용·체크 상태를 건드리지 않기 위해서다. */
    public PlanPackingItem withSortOrder(int sortOrder) {
        return toBuilder().sortOrder(sortOrder).build();
    }
}
