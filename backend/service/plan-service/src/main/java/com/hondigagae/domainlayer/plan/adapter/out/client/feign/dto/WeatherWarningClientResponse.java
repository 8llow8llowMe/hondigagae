package com.hondigagae.domainlayer.plan.adapter.out.client.feign.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.LocalDateTime;

/**
 * tour-service 내부 특보 응답({@code GET /internal/v1/weather/warnings})의 Feign 전용 표현.
 *
 * <p>{@code recommendationSuppressed} 를 tour-service 가 준다. 이쪽에서 단계 문자열로 경보를
 * 다시 판정하지 않는다 — 규칙이 두 서비스로 갈라지면 한쪽만 고쳐진다 (#357).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record WeatherWarningClientResponse(
    String typeCode,
    String typeName,
    String typeDescription,
    String levelCode,
    String levelName,
    String levelDescription,
    boolean recommendationSuppressed,
    LocalDateTime effectiveAt
) {

}
