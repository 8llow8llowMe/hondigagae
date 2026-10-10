package com.hondigagae.domainlayer.plan.application.service.processor;

import com.hondigagae.domainlayer.plan.application.port.out.PlanWalkCourseQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.query.PlanWalkCourseSummaryQueryResult;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 산책 코스 조회 스텁 (#715).
 *
 * <p>여러 테스트가 같은 포트를 쓰므로 한 곳에 둔다 — 파일마다 복제하면 <b>"목록에 없는 아이디는
 * 결과에서 빠진다"</b> 는 tour-service 의 실제 동작이 스텁마다 달라진다. 코스 검증이 그 동작
 * 하나에 전부 걸려 있어, 아이디를 그대로 돌려주는 스텁을 쓰면 검증 테스트가 늘 초록이 된다.
 */
class StubPlanWalkCourseQueryPort implements PlanWalkCourseQueryPort {

    /** 존재하는 코스 아이디. 여기 없는 아이디는 결과에서 빠진다. */
    final Set<Long> existingIds = new HashSet<>();

    /** 호출마다 요청 목록을 남긴다 — 항목마다 부르지 않는다는 것을 호출 횟수로 고정한다. */
    final List<List<Long>> requests = new ArrayList<>();

    @Override
    public List<PlanWalkCourseSummaryQueryResult> findSummaries(List<Long> walkCourseIds) {
        requests.add(List.copyOf(walkCourseIds));
        return walkCourseIds.stream()
            .filter(existingIds::contains)
            .map(walkCourseId -> PlanWalkCourseSummaryQueryResult.builder()
                .walkCourseId(walkCourseId)
                .name("코스 " + walkCourseId)
                .build())
            .toList();
    }
}
