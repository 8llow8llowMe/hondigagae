package com.hondigagae.domainlayer.placeimport.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.shared.travel.place.AllowedPetSize;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/**
 * 동반 가능 여부 재계산 규칙 (#886, 명세 §2-2 · §2-3).
 */
class PetAllowancePolicyTest {

    @ParameterizedTest(name = "allowance_scope {0} → {1}")
    @CsvSource({
        "FULL_AREA, ALLOWED",
        "PARTIAL, PARTIALLY_ALLOWED",
        "OUTDOOR_ONLY, PARTIALLY_ALLOWED",
        "UNKNOWN, UNKNOWN",
        "SOMETHING_NEW, UNKNOWN"
    })
    @DisplayName("동반 정보의 범위를 동반 구분 근거로 옮긴다 — 실외만 되는 곳은 '불가' 가 아니라 '일부' 다")
    void mapsAllowanceScope(String scope, PetAllowanceType expected) {
        assertThat(PetAllowancePolicy.allowanceOfScope(scope)).isEqualTo(expected);
    }

    @Test
    @DisplayName("동반 정보가 없으면(null) 근거가 아니다 — NOT_ALLOWED 로 읽지 않는다")
    void missingPetInfoIsNotEvidence() {
        assertThat(PetAllowancePolicy.allowanceOfScope(null)).isEqualTo(PetAllowanceType.UNKNOWN);
        assertThat(PetAllowancePolicy.mostRestrictiveAllowance(List.of(PetAllowancePolicy.allowanceOfScope(null))))
            .isEqualTo(PetAllowanceType.UNKNOWN);
    }

    @ParameterizedTest(name = "{0} → {1}")
    @CsvSource({
        "'ALLOWED', ALLOWED",
        "'PARTIALLY_ALLOWED', PARTIALLY_ALLOWED",
        "'NOT_ALLOWED', NOT_ALLOWED",
        "'ALLOWED,PARTIALLY_ALLOWED', PARTIALLY_ALLOWED",
        "'PARTIALLY_ALLOWED,ALLOWED', PARTIALLY_ALLOWED",
        "'ALLOWED,NOT_ALLOWED', NOT_ALLOWED",
        "'PARTIALLY_ALLOWED,NOT_ALLOWED,ALLOWED', NOT_ALLOWED",
        "'ALLOWED,UNKNOWN', ALLOWED",
        "'UNKNOWN,NOT_ALLOWED', NOT_ALLOWED",
        "'UNKNOWN,UNKNOWN', UNKNOWN",
        "'', UNKNOWN"
    })
    @DisplayName("동반 구분은 가장 제한적인 근거를 따르고 UNKNOWN 은 근거에서 빠진다")
    void picksMostRestrictiveAllowance(String evidences, PetAllowanceType expected) {
        List<PetAllowanceType> parsed = split(evidences).stream().map(PetAllowancePolicy::parseAllowance).toList();

        assertThat(PetAllowancePolicy.mostRestrictiveAllowance(parsed)).isEqualTo(expected);
    }

    @ParameterizedTest(name = "{0} → {1}")
    @CsvSource({
        "'ALL', ALL",
        "'SMALL_MEDIUM', SMALL_MEDIUM",
        "'SMALL_ONLY', SMALL_ONLY",
        "'ALL,SMALL_MEDIUM', SMALL_MEDIUM",
        "'SMALL_MEDIUM,SMALL_ONLY', SMALL_ONLY",
        "'ALL,SMALL_ONLY,SMALL_MEDIUM', SMALL_ONLY",
        "'UNKNOWN,ALL', ALL",
        "'UNKNOWN,UNKNOWN', UNKNOWN",
        "'', UNKNOWN"
    })
    @DisplayName("크기 제한도 같은 원칙이다 — 가장 제한적인 근거, UNKNOWN 은 근거 아님")
    void picksMostRestrictiveSize(String evidences, AllowedPetSize expected) {
        List<AllowedPetSize> parsed = split(evidences).stream().map(PetAllowancePolicy::parseSize).toList();

        assertThat(PetAllowancePolicy.mostRestrictiveSize(parsed)).isEqualTo(expected);
    }

    @Test
    @DisplayName("컬럼의 모르는 값 · null 은 UNKNOWN(근거 아님)으로 읽는다 — 한 행 때문에 잡이 실패하지 않는다")
    void unknownColumnValuesAreNotEvidence() {
        assertThat(PetAllowancePolicy.parseAllowance(null)).isEqualTo(PetAllowanceType.UNKNOWN);
        assertThat(PetAllowancePolicy.parseAllowance("MAYBE")).isEqualTo(PetAllowanceType.UNKNOWN);
        assertThat(PetAllowancePolicy.parseSize(null)).isEqualTo(AllowedPetSize.UNKNOWN);
        assertThat(PetAllowancePolicy.parseSize("TINY")).isEqualTo(AllowedPetSize.UNKNOWN);
    }

    private static List<String> split(String csv) {
        return csv.isBlank() ? List.of() : Arrays.asList(csv.split(","));
    }
}
