package com.hondigagae.domainlayer.emergency.application.port.out;

import com.hondigagae.domainlayer.emergency.application.model.NearbyFacilityQuery;
import com.hondigagae.domainlayer.emergency.application.port.out.query.EmergencyFacilityQueryResult;
import java.util.List;

public interface EmergencyFacilityRepositoryPort {

    /** 좌표 사각 범위 안의 동물병원. 정확한 반경 필터와 정렬은 호출한 쪽이 한다. */
    List<EmergencyFacilityQueryResult> findWithinBox(NearbyFacilityQuery query);
}
