package com.hondigagae.domainlayer.plan.application.port.out;

import com.hondigagae.domainlayer.plan.application.port.out.query.PlanPlacePointQueryResult;
import java.util.List;

/**
 * 일정 항목 장소의 좌표 조회 계약. 노출 불가(병합·delisted) 장소는 결과에서 빠진다 —
 * 호출부는 좌표 없는 항목을 브리핑에서 건너뛴다.
 */
public interface PlanPlaceLookupPort {

    List<PlanPlacePointQueryResult> findPoints(List<Long> placeIds);
}
