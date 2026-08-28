package com.hondigagae.domainlayer.plan.adapter.out.client.feign.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/**
 * tour-service 긴급 시설 응답의 Feign 전용 표현 (coding-conventions §12-1).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record EmergencyFacilitiesClientResponse(List<FacilityClientResponse> facilities) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record FacilityClientResponse(
        String name,
        MetadataClientResponse facilityType,
        String addr,
        String tel,
        Integer distanceMeters,
        Boolean open24,
        Boolean operatingHoursKnown
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record MetadataClientResponse(String code, String name, String description) {
    }
}
