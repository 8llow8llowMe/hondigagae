package com.hondigagae.domainlayer.plan.adapter.out.client.feign.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * tour-service 내부 후보 응답의 Feign 전용 표현 (coding-conventions §12-1).
 *
 * <p>원천 DTO({@code PlaceCandidateInternalResponse})는 프롬프트용 필드까지 갖고 있고, 이쪽은
 * <b>쓰는 것만</b> 다시 선언한다 — 응급 브리핑의 검색 중심점(좌표)과 일정 상세 항목의 장소
 * 요약(주소·실내 여부·대표 이미지, 이슈 #86 · 장소 유형·원본 분류, 이슈 #1461)이다.
 *
 * <p>{@code contentTypeCode} 는 enum 이름({@code RESTAURANT} 등), {@code contentTypeName} 은 표시명, {@code contentTypeDescription}
 * 은 설명이다 — 원천 metadata 를 편 세 값이다. 그 칸이 없는 옛 버전 tour-service 면 null 로 온다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record PlanPlaceClientResponse(
    Long placeId,
    String title,
    String addr,
    Boolean indoor,
    String firstImage,
    Double lat,
    Double lng,
    String contentTypeCode,
    String contentTypeName,
    String contentTypeDescription,
    String sourceCategory
) {

}
