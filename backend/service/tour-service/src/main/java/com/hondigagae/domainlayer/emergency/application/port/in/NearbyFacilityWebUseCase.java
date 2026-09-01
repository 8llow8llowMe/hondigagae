package com.hondigagae.domainlayer.emergency.application.port.in;

import com.hondigagae.domainlayer.emergency.adapter.in.web.dto.response.EmergencyFacilityDetailResponse;
import com.hondigagae.domainlayer.emergency.adapter.in.web.dto.response.NearbyFacilityResponse;
import com.hondigagae.domainlayer.emergency.application.model.NearbyFacilityQuery;

public interface NearbyFacilityWebUseCase {

    NearbyFacilityResponse searchNearby(NearbyFacilityQuery query);

    EmergencyFacilityDetailResponse getFacilityDetail(long facilityId);
}
