package com.hondigagae.domainlayer.insight.application.info;

import com.hondigagae.domainlayer.insight.domain.model.WalkSafetyAssessment;
import com.hondigagae.domainlayer.insight.domain.model.WeatherForecast;
import com.hondigagae.domainlayer.insight.domain.model.WeatherWarning;
import java.time.LocalDateTime;
import lombok.Builder;

/** 산책 위험도 응답 조립에 필요한 것 전부. */
@Builder
public record WalkSafetyInfo(
    long placeId,
    String placeTitle,
    LocalDateTime targetDateTime,
    WalkSafetyAssessment assessment,
    // 판정에 쓴 그 시각 예보. 근거를 확인할 수 있게 함께 내린다.
    WeatherForecast forecast,
    // 발효 중인 가장 무거운 특보. 없거나 조회 실패면 null 이다.
    WeatherWarning weatherWarning,
    boolean petConditionApplied
) {

}
