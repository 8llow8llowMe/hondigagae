package com.hondigagae.domainlayer.emergency.application.port.in;

import com.hondigagae.domainlayer.emergency.adapter.in.web.dto.response.NearbyHospitalResponse;
import com.hondigagae.domainlayer.emergency.application.model.NearbyHospitalQuery;

public interface NearbyHospitalWebUseCase {

    NearbyHospitalResponse searchNearby(NearbyHospitalQuery query);
}
