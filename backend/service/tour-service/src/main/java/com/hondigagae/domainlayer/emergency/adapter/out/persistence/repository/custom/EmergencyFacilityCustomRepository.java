package com.hondigagae.domainlayer.emergency.adapter.out.persistence.repository.custom;

import com.hondigagae.domainlayer.emergency.adapter.out.persistence.entity.EmergencyFacilityEntity;
import com.hondigagae.domainlayer.emergency.application.model.NearbyFacilityQuery;
import java.util.List;

/**
 * 좌표 사각 범위 + 동적 필터(종류·24시간) 검색.
 * 정확한 원형 반경과 거리 정렬은 호출한 쪽이 한다.
 */
public interface EmergencyFacilityCustomRepository {

    List<EmergencyFacilityEntity> searchWithinBox(NearbyFacilityQuery query);
}
