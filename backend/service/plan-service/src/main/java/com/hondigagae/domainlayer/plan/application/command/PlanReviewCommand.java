package com.hondigagae.domainlayer.plan.application.command;

import java.util.List;
import lombok.Builder;

/**
 * 여행 후기 작성·수정 커맨드. 일정당 하나라 생성과 수정이 같은 모양이다.
 *
 * @param items 장소별 평가. 빈 목록이면 전체 만족도만 남긴다. PUT 에서는 이 목록이 전량 교체다
 */
@Builder
public record PlanReviewCommand(
    int overallRating,
    String body,
    List<PlanReviewItemCommand> items
) {

}
