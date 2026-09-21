package com.hondigagae.domainlayer.plan.adapter.out.client.feign.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * tour-service 가 등급 metadata 로 쓰는 {@code ScoreMetricMetadata} 의 Feign 전용 표현.
 *
 * <p><b>한 벌만 둔다.</b> 적합도({@code PlaceSuitabilityClientResponse})·산책 위험도
 * ({@code PlaceWalkSafetyClientResponse})·골든타임({@code WalkTimesClientResponse})이 모두 이
 * 모양을 받는데, 예전에는 앞의 둘이 각자 중첩 레코드로 복제하고 셋째만 공유하고 있었다. 그래서
 * 원천에 칸이 하나 생기면 <b>복제본 중 하나만 고쳐지는 일이 두 번 일어났다</b> (#717, #759).
 *
 * <p>칸을 빼면 {@code @JsonIgnoreProperties(ignoreUnknown = true)} 때문에 <b>오류 없이 조용히
 * 버려진다.</b> 컴파일도 테스트도 통과하므로 "언제나 null 인 필드" 로만 보인다 — 그래서 원천
 * ({@code ScoreMetricDescribable})이 채워 보내는 네 칸을 여기서 모두 받는다.
 *
 * @param scoreDescription 점수 해석 문장. 등급 설명({@code description})과 다르다 — 이쪽은
 *                         "점수가 높을수록 …" 처럼 <b>점수를 어떻게 읽어야 하는지</b>를 말한다
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ScoreMetadataClientResponse(String code, String name, String description, String scoreDescription) {

}
