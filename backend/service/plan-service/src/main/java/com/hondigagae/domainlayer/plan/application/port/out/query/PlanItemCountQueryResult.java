package com.hondigagae.domainlayer.plan.application.port.out.query;

/**
 * 일정 하나가 담은 항목 수. 일정 목록이 페이지의 일정 아이디로 한 번에 집계해 받는다.
 *
 * <p>항목이 하나도 없는 일정은 집계 결과에 행이 없다 — 호출자가 0 으로 읽는다.
 */
public record PlanItemCountQueryResult(
    long planId,
    long itemCount
) {
}
