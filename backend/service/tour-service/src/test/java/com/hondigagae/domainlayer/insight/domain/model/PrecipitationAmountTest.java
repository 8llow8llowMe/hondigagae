package com.hondigagae.domainlayer.insight.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * PCP 는 숫자가 아니라 사람이 읽는 문자열이 섞여 오는 항목이다. 그대로 파싱하면 터지고,
 * 터지지 않게 하려고 대충 0 으로 두면 "비가 오는데 안 온다고 말하는" 더 나쁜 버그가 된다.
 */
class PrecipitationAmountTest {

    @Test
    @DisplayName("강수없음은 0mm 로 본다")
    void parsesNoPrecipitation() {
        PrecipitationAmount amount = PrecipitationAmount.parse("강수없음");

        assertThat(amount.millimeters()).isZero();
        assertThat(amount.hasPrecipitation()).isFalse();
    }

    @Test
    @DisplayName("1mm 미만은 0 이 아니다 - 0 으로 두면 비가 안 온다는 뜻이 되어 버린다")
    void parsesTraceAsNonZero() {
        PrecipitationAmount amount = PrecipitationAmount.parse("1mm 미만");

        assertThat(amount.hasPrecipitation()).isTrue();
        assertThat(amount.millimeters()).isEqualTo(0.5d);
        assertThat(amount.text()).isEqualTo("1mm 미만");
    }

    @Test
    @DisplayName("범위 표기는 하한을 취하되 원문을 잃지 않는다")
    void parsesRangeUsingLowerBound() {
        PrecipitationAmount amount = PrecipitationAmount.parse("30.0~50.0mm");

        assertThat(amount.millimeters()).isEqualTo(30.0d);
        assertThat(amount.text()).isEqualTo("30.0~50.0mm");
    }

    @Test
    @DisplayName("이상 표기는 표기된 수를 취한다")
    void parsesAtLeastNotation() {
        assertThat(PrecipitationAmount.parse("50.0mm 이상").millimeters()).isEqualTo(50.0d);
    }

    @Test
    @DisplayName("보통의 수치 표기도 그대로 읽는다")
    void parsesPlainMillimeters() {
        assertThat(PrecipitationAmount.parse("1.0mm").millimeters()).isEqualTo(1.0d);
    }

    @Test
    @DisplayName("실측된 값 전부를 해석한다 (2026-08-27 제주 격자 53/38)")
    void parsesEveryObservedValue() {
        // 한 회차에서 실제로 관측된 PCP 값 목록이다. 맨숫자와 mm 표기가 섞여 온다.
        assertThat(PrecipitationAmount.parse("0").hasPrecipitation()).isFalse();
        assertThat(PrecipitationAmount.parse("강수없음").hasPrecipitation()).isFalse();
        assertThat(PrecipitationAmount.parse("1mm 미만").millimeters()).isEqualTo(0.5d);
        assertThat(PrecipitationAmount.parse("1").millimeters()).isEqualTo(1.0d);
        assertThat(PrecipitationAmount.parse("2").millimeters()).isEqualTo(2.0d);
        assertThat(PrecipitationAmount.parse("1.0mm").millimeters()).isEqualTo(1.0d);
        assertThat(PrecipitationAmount.parse("4.0mm").millimeters()).isEqualTo(4.0d);
        assertThat(PrecipitationAmount.parse("12.0mm").millimeters()).isEqualTo(12.0d);
    }

    @Test
    @DisplayName("SNO 는 같은 뜻을 적설없음으로 준다 - 실측 확인")
    void parsesSnowfallNone() {
        assertThat(PrecipitationAmount.parse("적설없음").hasPrecipitation()).isFalse();
    }

    @Test
    @DisplayName("빈 값과 해석 불가 문자열은 강수없음으로 보되 터지지 않는다")
    void toleratesUnknownFormats() {
        assertThat(PrecipitationAmount.parse(null).hasPrecipitation()).isFalse();
        assertThat(PrecipitationAmount.parse("").hasPrecipitation()).isFalse();
        assertThat(PrecipitationAmount.parse("-").hasPrecipitation()).isFalse();

        PrecipitationAmount unknown = PrecipitationAmount.parse("알 수 없음");
        assertThat(unknown.millimeters()).isZero();
        assertThat(unknown.text()).isEqualTo("알 수 없음");
    }
}
