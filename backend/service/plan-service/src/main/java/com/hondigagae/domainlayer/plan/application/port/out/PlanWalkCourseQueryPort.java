package com.hondigagae.domainlayer.plan.application.port.out;

import com.hondigagae.domainlayer.plan.application.port.out.query.PlanWalkCourseSummaryQueryResult;
import java.util.List;

/**
 * 일정 항목({@code WALK})이 가리키는 산책 코스의 요약 조회 계약 (이슈 #619).
 *
 * <p><b>목록에 없는 아이디는 결과에서 빠진다.</b> 그 뜻을 부르는 쪽에 따라 다르게 읽는다.
 *
 * <ul>
 *   <li><b>읽기(일정 상세)는 관용이다</b> — 그 항목을 지우지 않고 요약만 비운다. {@code WALK} 의
 *       {@code targetId} 는 저장 시 검증되지만(#715) 그 이전에 들어온 행과 수기로 정리된 행이
 *       남아 있을 수 있다. 그런 항목 하나 때문에 일정 상세가 통째로 죽으면 안 된다</li>
 *   <li><b>저장(타깃 검증)은 거부다</b> — {@code PlanCommandProcessor} 가 이 메서드를 존재 확인에
 *       쓰고, 빠진 아이디가 하나라도 있으면 {@code PLAN_025} 로 거절한다. 새로 담는 항목이
 *       없는 코스를 가리키는 것은 제목만 남은 줄을 만드는 일이라 관용의 대상이 아니다</li>
 * </ul>
 *
 * <p><b>한 번에 받는다.</b> 항목마다 부르면 일정 하나 조회·저장에 HTTP 왕복이 항목 수만큼 생긴다.
 */
public interface PlanWalkCourseQueryPort {

    List<PlanWalkCourseSummaryQueryResult> findSummaries(List<Long> walkCourseIds);
}
