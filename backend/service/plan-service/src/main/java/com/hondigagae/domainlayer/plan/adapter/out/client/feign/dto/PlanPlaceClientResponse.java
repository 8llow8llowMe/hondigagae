package com.hondigagae.domainlayer.plan.adapter.out.client.feign.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * tour-service 내부 후보 응답의 Feign 전용 표현 (coding-conventions §12-1).
 *
 * <p>원천 DTO({@code PlaceCandidateInternalResponse})는 프롬프트용 필드까지 갖고 있고, 이쪽은
 * <b>쓰는 것만</b> 다시 선언한다 — 응급 브리핑의 검색 중심점(좌표)과 일정 상세 항목의 장소
 * 요약(주소·실내 여부·대표 이미지, 이슈 #86)이다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record PlanPlaceClientResponse(
    Long placeId,
    String title,
    String addr,
    Boolean indoor,
    String firstImage,
    Double lat,
    Double lng
) {

}
