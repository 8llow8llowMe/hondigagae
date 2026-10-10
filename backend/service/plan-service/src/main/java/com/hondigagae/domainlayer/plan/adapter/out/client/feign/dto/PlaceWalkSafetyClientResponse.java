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
 *
 * <p>등급 metadata 는 {@link ScoreMetadataClientResponse} 를 쓴다 — 적합도·골든타임과 같은
 * 스키마라 <b>같은 패키지의 한 벌을 공유한다</b>. 여기에 중첩 레코드로 복제해 두었을 때
 * {@code scoreDescription} 칸이 빠져 원천의 값이 조용히 버려졌다 (#717).
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

}
