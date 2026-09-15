package com.hondigagae.domainlayer.plan.domain.model;

import java.time.LocalDateTime;
import lombok.Builder;

/**
 * 일정 하나당 하나인 여행 후기.
 *
 * <p>일차를 교체해도 이 행은 남는다. 장소별 평가는 {@link PlanReviewItem} 이 그때의
 * 항목 아이디·제목·장소를 기억한다.
 */
@Builder(toBuilder = true)
public record PlanReview(
    long id,
    long planId,
    int overallRating,
    String body,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {

}
