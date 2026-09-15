package com.hondigagae.domainlayer.plan.application.command;

import lombok.Builder;

/**
 * 방문 장소 한 줄. 제목·placeId 는 요청에 받지 않는다 — 클라이언트가 보낸 이름을 믿으면
 * 일차 교체 전후 제목이 갈리고, 후기가 기억해야 할 "그때의 이름"이 화면 입력에 묶인다.
 */
@Builder
public record PlanReviewItemCommand(
    long planItemId,
    int rating,
    String comment
) {

}
