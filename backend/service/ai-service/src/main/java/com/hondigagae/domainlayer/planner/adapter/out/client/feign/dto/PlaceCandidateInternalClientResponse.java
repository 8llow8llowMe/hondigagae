package com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * tour-service 내부 후보 응답의 Feign 전용 표현 (coding-conventions §12-1).
 * 표시명이 이미 변환되어 오므로 enum 매핑 없이 그대로 후보로 옮긴다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record PlaceCandidateInternalClientResponse(
    Long placeId,
    String title,
    String contentTypeName,
    String addr,
    String petAllowanceName,
    String allowedPetSizeName,
    Integer maxPetWeightKg,
    Boolean indoor,
    String sourceCategory,
    Double lat,
    Double lng
) {

}
