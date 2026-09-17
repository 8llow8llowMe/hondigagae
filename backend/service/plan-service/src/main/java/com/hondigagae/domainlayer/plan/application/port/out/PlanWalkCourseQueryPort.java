package com.hondigagae.domainlayer.plan.application.port.out;

import com.hondigagae.domainlayer.plan.application.port.out.query.PlanWalkCourseSummaryQueryResult;
import java.util.List;

/**
 * 일정 항목({@code WALK})이 가리키는 산책 코스의 요약 조회 계약 (이슈 #619).
 *
 * <p>목록에 없는 아이디는 결과에서 빠진다 — 호출부는 그 항목을 지우지 않고 요약만 비운다.
 * {@code WALK} 의 {@code targetId} 는 <b>저장 시 검증되지 않고</b>(장소와 달리 walk_course
 * 존재 확인 경로가 없다), 수기로 정리된 행도 있을 수 있다. 그런 항목 하나 때문에 일정 상세가
 * 통째로 죽으면 안 된다.
 *
 * <p><b>한 번에 받는다.</b> 항목마다 부르면 일정 하나 조회에 HTTP 왕복이 항목 수만큼 생긴다.
 */
public interface PlanWalkCourseQueryPort {

    List<PlanWalkCourseSummaryQueryResult> findSummaries(List<Long> walkCourseIds);
}
