package com.hondigagae.domainlayer.plan.application.port.out;

import com.hondigagae.domainlayer.plan.application.port.out.query.PlanPlaceSummaryQueryResult;
import java.util.List;

/**
 * 일정 항목 장소의 요약 조회 계약. 노출 불가(병합·delisted) 장소는 결과에서 빠진다 —
 * 호출부는 그 항목을 지우지 않고 요약만 비운다.
 *
 * <p><b>한 번에 받는다.</b> 항목마다 부르면 일정 하나 조회에 HTTP 왕복이 항목 수만큼 생긴다.
 */
public interface PlanPlaceLookupPort {

    List<PlanPlaceSummaryQueryResult> findSummaries(List<Long> placeIds);
}
