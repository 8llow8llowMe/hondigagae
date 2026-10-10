package com.hondigagae.domainlayer.plan.adapter.out.client.feign.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.hondigagae.domainlayer.plan.adapter.out.client.feign.dto.PlaceSuitabilityClientResponse.MetadataClientResponse;
import java.time.LocalDateTime;

/**
 * tour-service 골든타임 응답의 Feign 전용 표현.
 *
 * <p><b>필요한 필드만 선언한다.</b> {@code hourly}(시간대별 곡선)와 {@code weatherWarning} 은
 * 일부러 뺐다 — 곡선은 브리핑이 싣지 않고, 특보는 전용 내부 경로로 따로 받는다.
 * {@code @JsonIgnoreProperties(ignoreUnknown = true)} 라 원천이 그 필드를 보내도 조용히 버린다.
 *
 * <p>등급 metadata 는 {@link ScoreMetadataClientResponse} 를, 코드·이름·설명만 있는 metadata 는
 * {@link PlaceSuitabilityClientResponse} 의 중첩 레코드를 재사용한다 — 같은 서비스의 같은
 * 스키마를 두 번 선언하지 않는다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record WalkTimesClientResponse(
    LocalDateTime from,
    MetadataClientResponse forecastCoverage,
    LocalDateTime goldenStart,
    LocalDateTime goldenEnd,
    ScoreMetadataClientResponse goldenLevel,
    MetadataClientResponse goldenWindowStatus,
    boolean petConditionApplied
) {

}
