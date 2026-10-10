package com.hondigagae.domainlayer.pet.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.YearMonth;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 생년월 → 나이(개월) 파생 (#367).
 *
 * <p>내부 계약이 생년월 원문 대신 이 파생값을 내보낸다. 모르는 것은 null 로 남긴다 —
 * 나이를 지어내면 노령견 판단이 거짓 근거 위에 선다.
 */
class PetAgeMonthsTest {

    private static final YearMonth NOW = YearMonth.of(2026, 9);

    @Test
    @DisplayName("생년월에서 개월 수를 파생한다 - 같은 달은 0개월이다")
    void derivesMonthsFromBirthYm() {
        assertThat(Pet.ageMonths("2017-05", NOW)).isEqualTo(112);   // 9년 4개월
        assertThat(Pet.ageMonths("2026-01", NOW)).isEqualTo(8);
        assertThat(Pet.ageMonths("2026-09", NOW)).isEqualTo(0);
    }

    @Test
    @DisplayName("생년월이 없거나 형식이 어긋나거나 미래면 null 이다 - 지어내지 않는다")
    void unknownOrInvalidBirthYmYieldsNull() {
        assertThat(Pet.ageMonths(null, NOW)).isNull();
        assertThat(Pet.ageMonths("  ", NOW)).isNull();
        assertThat(Pet.ageMonths("2017/05", NOW)).isNull();
        // 미래 생년월은 저장이 막혀 있지만(PET_003) 방어한다
        assertThat(Pet.ageMonths("2026-10", NOW)).isNull();
    }
}
