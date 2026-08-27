package com.hondigagae.domainlayer.insight.application.info;

import com.hondigagae.domainlayer.insight.domain.model.WalkSafetyAssessment;
import com.hondigagae.domainlayer.insight.domain.model.WeatherForecast;
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
    boolean petConditionApplied
) {

}
