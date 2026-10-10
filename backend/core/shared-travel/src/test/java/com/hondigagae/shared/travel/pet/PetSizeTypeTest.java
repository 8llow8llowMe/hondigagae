package com.hondigagae.shared.travel.pet;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 크기 경계의 단일 출처 (#364).
 *
 * <p>경계(10kg/25kg)는 이 enum 의 설명 문자열("10kg 미만" 등)과 화면 안내문이 이미 말하고
 * 있다 - {@code fromWeight} 가 그것과 다르게 가르면 사용자가 안내문대로 고른 크기를
 * 서버가 거부한다.
 */
class PetSizeTypeTest {

    @Test
    @DisplayName("경계값은 설명 문자열과 같이 가른다 - 10kg 은 중형, 25kg 은 대형이다")
    void boundariesFollowDescriptions() {
        assertThat(PetSizeType.fromWeight(new BigDecimal("0.1"))).isEqualTo(PetSizeType.SMALL);
        assertThat(PetSizeType.fromWeight(new BigDecimal("9.9"))).isEqualTo(PetSizeType.SMALL);
        assertThat(PetSizeType.fromWeight(new BigDecimal("10.0"))).isEqualTo(PetSizeType.MEDIUM);
        assertThat(PetSizeType.fromWeight(new BigDecimal("24.9"))).isEqualTo(PetSizeType.MEDIUM);
        assertThat(PetSizeType.fromWeight(new BigDecimal("25.0"))).isEqualTo(PetSizeType.LARGE);
        assertThat(PetSizeType.fromWeight(new BigDecimal("99.9"))).isEqualTo(PetSizeType.LARGE);
    }

    @Test
    @DisplayName("체중을 모르면 크기를 지어내지 않는다")
    void unknownWeightYieldsNull() {
        assertThat(PetSizeType.fromWeight(null)).isNull();
    }

    @Test
    @DisplayName("matchesWeight - 체중이 없으면 어긋남을 판정할 수 없어 참이다")
    void matchesWeightSkipsWhenUnknown() {
        assertThat(PetSizeType.LARGE.matchesWeight(null)).isTrue();
        assertThat(PetSizeType.SMALL.matchesWeight(new BigDecimal("3.8"))).isTrue();
        assertThat(PetSizeType.SMALL.matchesWeight(new BigDecimal("30.0"))).isFalse();
    }
}
