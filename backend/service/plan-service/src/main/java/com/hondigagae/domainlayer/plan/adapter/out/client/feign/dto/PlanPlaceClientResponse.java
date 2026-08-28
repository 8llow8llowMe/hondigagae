package com.hondigagae.domainlayer.plan.adapter.out.client.feign.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * tour-service 내부 후보 응답의 Feign 전용 표현 (coding-conventions §12-1).
 * 응급 브리핑에는 좌표만 필요하므로 그것만 다시 선언한다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record PlanPlaceClientResponse(
    Long placeId,
    String title,
    Double lat,
    Double lng
) {

}
