package com.hondigagae.domainlayer.insight.domain.enums;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 홈 특보 띠가 {@code description} 을 그대로 그린다.
 *
 * <p>다가오는 일정이 없는 사람에게도 같은 문장이 나간다. "일정을 조정하라"·"일정을 취소하라"가
 * 들어가면 일정이 없는 사용자에게 없는 일을 시킨다 (#1173).
 */
class WeatherWarningLevelTest {

    @Test
    @DisplayName("주의보 문구는 일정 조정을 말하지 않고 바깥 활동 주의만 말한다")
    void advisoryDoesNotAssumeAPlan() {
        assertThat(WeatherWarningLevel.ADVISORY.getDescription())
            .isEqualTo("기상 조건이 나빠지고 있습니다. 바깥 활동은 주의가 필요합니다.")
            .doesNotContain("일정");
    }

    @Test
    @DisplayName("경보 문구는 야외 일정 취소를 말하지 않고 바깥 활동을 피하라고 말한다")
    void warningDoesNotAssumeAPlan() {
        assertThat(WeatherWarningLevel.WARNING.getDescription())
            .isEqualTo("기상청이 위험을 경고한 단계입니다. 바깥 활동은 피하는 편이 좋습니다.")
            .doesNotContain("일정");
    }
}
