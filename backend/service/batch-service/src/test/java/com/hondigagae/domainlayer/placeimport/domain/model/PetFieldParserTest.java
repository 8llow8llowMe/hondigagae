package com.hondigagae.domainlayer.placeimport.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 체중 상한 파싱 검증. 예시는 전부 문화정보원 제주 CSV 에 실재하는 원문이다.
 */
class PetFieldParserTest {

    /*
     * 아래 둘은 관광 API(detailPetTour2) 원문이다 — 2026-09-23 제주 표본 29건 실측 (#877).
     * acmpyTypeCd 는 "전구역 동반가능" 16 · "일부구역 동반가능" 13, 두 값뿐이었다.
     */
    @Test
    @DisplayName("동반 구역은 확인된 두 원문을 옮기고 모르는 문구는 UNKNOWN 이다 (#877)")
    void parseAllowanceScope() {
        assertThat(PetFieldParser.parseAllowanceScope("전구역 동반가능")).isEqualTo(PetFieldParser.SCOPE_FULL_AREA);
        assertThat(PetFieldParser.parseAllowanceScope("일부구역 동반가능")).isEqualTo(PetFieldParser.SCOPE_PARTIAL);
        assertThat(PetFieldParser.parseAllowanceScope("일부 실외 구역 동반가능")).isEqualTo(PetFieldParser.SCOPE_OUTDOOR_ONLY);
        assertThat(PetFieldParser.parseAllowanceScope("동반 가능")).isEqualTo(PetFieldParser.SCOPE_UNKNOWN);
        assertThat(PetFieldParser.parseAllowanceScope(null)).isEqualTo(PetFieldParser.SCOPE_UNKNOWN);
        assertThat(PetFieldParser.parseAllowanceScope(" ")).isEqualTo(PetFieldParser.SCOPE_UNKNOWN);
    }

    @Test
    @DisplayName("목줄은 원천이 말했을 때만 true 다 — false 는 '필요 없음' 이 아니라 '말 없음' 이다 (#877)")
    void parseLeashRequired() {
        assertThat(PetFieldParser.parseLeashRequired("목줄 착용")).isTrue();
        assertThat(PetFieldParser.parseLeashRequired("입마개 착용,목줄 착용")).isTrue();
        assertThat(PetFieldParser.parseLeashRequired("목줄 착용,이동장(켄넬)사용,기타")).isTrue();
        assertThat(PetFieldParser.parseLeashRequired("자유이용,매너벨트 착용")).isFalse();
        assertThat(PetFieldParser.parseLeashRequired(null)).isFalse();
    }

    @Test
    @DisplayName("관광 API 크기 원문도 기존 규칙으로 읽힌다 — 새 규칙 없이 재사용한다 (#877)")
    void parseTourApiPetSizeWithExistingRule() {
        assertThat(PetFieldParser.parseAllowedPetSize("전 견종 동반 가능")).isEqualTo(PetFieldParser.SIZE_ALL);
        assertThat(PetFieldParser.parseAllowedPetSize("훈련된 5KG 이하 반려견")).isEqualTo(PetFieldParser.SIZE_SMALL_ONLY);
        assertThat(PetFieldParser.parseAllowedPetSize("15kg 미만 까지만 가능")).isEqualTo(PetFieldParser.SIZE_SMALL_MEDIUM);
        assertThat(PetFieldParser.parseAllowedPetSize("소형견 1마리")).isEqualTo(PetFieldParser.SIZE_SMALL_ONLY);
        assertThat(PetFieldParser.parseAllowedPetSize("")).isEqualTo(PetFieldParser.SIZE_UNKNOWN);
    }

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
