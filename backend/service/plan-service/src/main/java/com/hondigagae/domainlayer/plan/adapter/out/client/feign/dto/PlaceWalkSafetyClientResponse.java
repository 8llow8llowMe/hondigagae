package com.hondigagae.domainlayer.plan.adapter.out.client.feign.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * tour-service 산책 위험도 응답의 Feign 전용 표현.
 *
 * <p>응답 전체를 받지 않는다 — 일정 화면이 항목 줄에 붙일 수 있는 만큼만 든다. 근거 목록·
 * 시간대별 판정·특보 상세가 필요해지면 화면이 장소 위험도 API 를 직접 부른다. 항목마다 그
 * 전부를 실어 나르면 일정 응답이 항목 수만큼 부푼다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record PlaceWalkSafetyClientResponse(
    String placeId,
    String placeTitle,
    LocalDateTime targetDateTime,
    ScoreMetadataClientResponse walkSafetyLevel,
    Double estimatedPavementCelsius,
    Double feelsLikeCelsius,
    Double temperature,
    LocalTime saferWindowStart,
    LocalTime saferWindowEnd,
    boolean petConditionApplied
) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ScoreMetadataClientResponse(String code, String name, String description) {

    }
}
