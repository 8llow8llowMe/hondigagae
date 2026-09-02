package com.hondigagae.domainlayer.insight.domain.model;

import com.hondigagae.domainlayer.insight.domain.enums.WeatherWarningLevel;
import com.hondigagae.domainlayer.insight.domain.enums.WeatherWarningType;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import lombok.Builder;

/**
 * 발효 중인 기상특보 한 건.
 *
 * <p>여러 특보가 동시에 뜨는 일이 흔하다(태풍 + 호우 + 강풍). 판정에는 <b>가장 무거운 것</b>을
 * 쓰되 목록은 그대로 내려 준다 - 어느 특보 때문인지 사용자가 알아야 한다.
 */
@Builder
public record WeatherWarning(
    WeatherWarningType type,
    WeatherWarningLevel level,
    // 발효 시각. 원천이 주지 않으면 null 이다.
    LocalDateTime effectiveAt,
    // 원천 문구 그대로. 우리가 해석하지 못한 내용까지 화면이 보여 줄 수 있게 남긴다.
    String sourceText
) {

    /**
     * 가장 무거운 특보. 단계(경보 > 주의보)를 먼저 보고, 같으면 종류 선언 순서를 쓴다.
     *
     * <p>선언 순서가 곧 심각도다 - 태풍이 맨 앞이고 건조가 맨 뒤다.
     */
    public static Optional<WeatherWarning> heaviest(List<WeatherWarning> warnings) {
        if (warnings == null || warnings.isEmpty()) {
            return Optional.empty();
        }
        return warnings.stream().min(
            Comparator.comparing((WeatherWarning warning) -> warning.level().isWarning() ? 0 : 1)
                .thenComparingInt(warning -> warning.type().ordinal()));
    }
}
