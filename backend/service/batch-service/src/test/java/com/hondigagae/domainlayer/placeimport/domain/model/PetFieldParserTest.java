package com.hondigagae.domainlayer.placeimport.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 체중 상한 파싱 검증. 예시는 전부 문화정보원 제주 CSV 에 실재하는 원문이다.
 */
class PetFieldParserTest {

    @Test
    @DisplayName("kg 숫자가 있으면 상한으로 보존한다 — enum 은 10kg 경계로 뭉개는 자리")
    void parseExplicitWeightLimit() {
        assertThat(PetFieldParser.parseMaxWeightKg("5kg 이하")).isEqualTo(5);
        assertThat(PetFieldParser.parseMaxWeightKg("12kg 미만")).isEqualTo(12);
        assertThat(PetFieldParser.parseMaxWeightKg("30kg 미만")).isEqualTo(30);
    }

    @Test
    @DisplayName("숫자가 없는 표현은 null — enum 판정에 맡긴다")
    void nonNumericReturnsNull() {
        assertThat(PetFieldParser.parseMaxWeightKg("모두 가능")).isNull();
        assertThat(PetFieldParser.parseMaxWeightKg("소형/중형")).isNull();
        assertThat(PetFieldParser.parseMaxWeightKg("해당없음")).isNull();
        assertThat(PetFieldParser.parseMaxWeightKg(null)).isNull();
        assertThat(PetFieldParser.parseMaxWeightKg("  ")).isNull();
    }

    @Test
    @DisplayName("체중이 있는 원문은 enum 과 숫자가 같은 방향을 가리킨다")
    void weightAndEnumAgree() {
        // "12kg 미만" — enum 은 SMALL_MEDIUM(중형까지)로 넓게 잡히지만 숫자가 12 로 남아
        // 체중 필터가 정확히 거를 수 있다
        assertThat(PetFieldParser.parseAllowedPetSize("12kg 미만")).isEqualTo(PetFieldParser.SIZE_SMALL_MEDIUM);
        assertThat(PetFieldParser.parseMaxWeightKg("12kg 미만")).isEqualTo(12);

        assertThat(PetFieldParser.parseAllowedPetSize("5kg 이하")).isEqualTo(PetFieldParser.SIZE_SMALL_ONLY);
        assertThat(PetFieldParser.parseMaxWeightKg("5kg 이하")).isEqualTo(5);
    }
}
