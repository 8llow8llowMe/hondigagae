package com.hondigagae.domainlayer.plan.application.port.out;

import com.hondigagae.domainlayer.plan.application.port.out.query.EmergencyFacilityQueryResult;
import java.util.List;

/**
 * 긴급 시설 반경 검색 계약. 전송 실패는 {@code PlanException}(PLAN_900)으로 올라온다 —
 * 응급 브리핑은 이 데이터가 전부라, 시설 없이 내려간 브리핑은 안전하다는 착각만 준다.
 */
public interface EmergencyFacilityQueryPort {

    List<EmergencyFacilityQueryResult> findNearby(double lat, double lng, int radiusMeters, int size);
}
