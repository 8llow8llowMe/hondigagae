package com.hondigagae.domainlayer.emergency.application.port.out;

import com.hondigagae.domainlayer.emergency.application.model.NearbyFacilityQuery;
import com.hondigagae.domainlayer.emergency.application.port.out.query.EmergencyFacilityQueryResult;
import java.util.List;
import java.util.Optional;

public interface EmergencyFacilityRepositoryPort {

    /** 좌표 사각 범위 안의 동물병원. 정확한 반경 필터와 정렬은 호출한 쪽이 한다. */
    List<EmergencyFacilityQueryResult> findWithinBox(NearbyFacilityQuery query);

    /**
     * 단건 조회.
     *
     * <p>원천에서 내려간(delisted) 시설은 없는 것으로 본다 - 목록이 안 보여 주는 시설을
     * 상세로는 볼 수 있으면, 폐업한 병원 주소를 들고 급하게 찾아가게 된다.
     */
    Optional<EmergencyFacilityQueryResult> findById(long facilityId);
}
