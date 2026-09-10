package com.hondigagae.domainlayer.insight.adapter.in.internal.dto;

import java.time.LocalDateTime;
import lombok.Builder;

/**
 * 다른 서비스가 가져가는 기상특보 — <b>가장 무거운 특보 한 건</b>. 웹 응답 4곳(적합도·산책
 * 위험도·골든타임·권역 추천)과 같은 규칙으로 고른다.
 *
 * <p>여러 특보가 동시에 뜨는 일이 흔하다(태풍 + 호우 + 강풍). 판정은 하나로 해야 하므로
 * {@code WeatherWarning.heaviest} 가 고른 것을 그대로 준다.
 *
 * <p>enum metadata 대신 code/name/description 을 펴서 준다 — 내부 DTO 는 소비 측이 자기
 * 응답 모양으로 다시 조립하므로, 이쪽 metadata 타입을 그대로 실으면 그 타입이 서비스 경계를
 * 넘는다.
 *
 * <p><b>{@code recommendationSuppressed} 를 우리가 준다.</b> "경보면 추천을 막는다" 는 판정을
 * 소비 측이 {@code level == WARNING} 으로 다시 세우면 한쪽만 고쳐질 수 있고, 그러면 같은
 * 특보에 서로 다른 말을 하는 화면이 생긴다 (#357 과 같은 이유).
 */
@Builder
public record WeatherWarningInternalResponse(
    String typeCode,
    String typeName,
    String typeDescription,
    String levelCode,
    String levelName,
    String levelDescription,
    // 경보 단계라 추천·골든타임을 보류해야 하는지. 소비 측이 다시 판정하지 않는다.
    boolean recommendationSuppressed,
    // 발효 시각. 원천이 주지 않으면 null 이다.
    LocalDateTime effectiveAt
) {

}
