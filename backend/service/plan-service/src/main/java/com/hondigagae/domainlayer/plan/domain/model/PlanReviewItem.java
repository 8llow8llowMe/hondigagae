package com.hondigagae.domainlayer.plan.domain.model;

import java.time.LocalDateTime;
import lombok.Builder;

/**
 * 방문 장소 항목 하나에 대한 후기 스냅샷.
 *
 * <p>일차 교체로 {@code plan_item} 행이 사라져도 여기 제목·placeId 는 남는다 — 그때 다녀온
 * 장소의 기록이다. {@code placeId} 는 작성 시점의 {@code PlanItem.targetId} 이고, 대상 없는
 * 장소 항목이면 null 이다.
 */
@Builder(toBuilder = true)
public record PlanReviewItem(
    long id,
    long reviewId,
    long planItemId,
    Long placeId,
    String title,
    int rating,
    String comment,
    int sortOrder,
    LocalDateTime createdAt
) {

}
