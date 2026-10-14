package com.hondigagae.domainlayer.placeimport.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportErrorCode;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportException;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 장소 보정 항목의 불변식 (#1434). 잘못된 항목은 만들어지지 않는다 — 적용하다 말고 깨지는 것보다 읽는 순간 실패하는 편이 낫다.
 */
class PlaceOverrideTest {

    private static final List<String> EVIDENCE = List.of("문화정보원 CSV 20250324");

    @Test
    @DisplayName("동반 구분을 바꾸면 pet_available 도 그 규칙으로 따라온다 — 칸을 적지 않으면 둘 다 그대로다")
    void derivesPetAvailableFromAllowance() {
        assertThat(override(PetAllowanceType.UNKNOWN).petAvailable()).isFalse();
        assertThat(override(PetAllowanceType.NOT_ALLOWED).petAvailable()).isFalse();
        assertThat(override(PetAllowanceType.PARTIALLY_ALLOWED).petAvailable()).isTrue();
        assertThat(override(PetAllowanceType.ALLOWED).petAvailable()).isTrue();
        assertThat(new PlaceOverride(1L, "한림공원", false, true, null, "야외 정원", EVIDENCE).petAvailable()).isNull();
    }

    @Test
    @DisplayName("적용 판정은 id 와 정확한 제목이다 — 대소문자 · 뒤 공백이 달라도 다른 행이다")
    void appliesOnlyToSameIdAndExactTitle() {
        PlaceOverride daiso = override(PetAllowanceType.UNKNOWN);

        assertThat(daiso.appliesTo(2907285L, "다이소 제주연동점")).isTrue();
        assertThat(daiso.appliesTo(2907285L, "다이소 제주연동점 ")).isFalse();
        assertThat(daiso.appliesTo(2907285L, "올리브영 제주연동점")).isFalse();
        assertThat(daiso.appliesTo(2907285L, null)).isFalse();
        assertThat(daiso.appliesTo(4026812L, "다이소 제주연동점")).isFalse();
        assertThat(new PlaceOverride(1L, "Cafe", false, null, null, "근거", EVIDENCE).appliesTo(1L, "cafe")).isFalse();
    }

    @Test
    @DisplayName("동반 구분을 적은 보정만 동반 칸을 소유한다")
    void ownsPetAllowanceOnlyWhenWritten() {
        assertThat(override(PetAllowanceType.UNKNOWN).overridesPetAllowance()).isTrue();
        assertThat(new PlaceOverride(126455L, "한림공원", false, true, null, "야외 정원", EVIDENCE).overridesPetAllowance()).isFalse();
    }

    @Test
    @DisplayName("적은 칸만 바꾸고 나머지는 지금 값 그대로다 — 이미 그 값이면 결과가 지금과 같다")
    void appliesOnlyWrittenColumns() {
        OverridablePlace hallim = new OverridablePlace(126455L, "한림공원", true, true, "ALLOWED", "ALL", true);
        PlaceOverride indoorOnly = new PlaceOverride(126455L, "한림공원", false, null, null, "야외 정원", EVIDENCE);

        assertThat(indoorOnly.applyTo(hallim)).isEqualTo(new OverridablePlace(126455L, "한림공원", false, true, "ALLOWED", "ALL", true));
        assertThat(indoorOnly.applyTo(indoorOnly.applyTo(hallim))).isEqualTo(indoorOnly.applyTo(hallim));
    }

    @Test
    @DisplayName("동반 구분을 UNKNOWN · NOT_ALLOWED 로 바꾸면 크기 제한도 UNKNOWN, 가능 쪽이면 크기는 그대로다")
    void resetsSizeWhenNotAllowedOrUnknown() {
        OverridablePlace daiso = new OverridablePlace(2907285L, "다이소 제주연동점", null, null, "ALLOWED", "ALL", true);

        assertThat(override(PetAllowanceType.UNKNOWN).applyTo(daiso))
            .isEqualTo(new OverridablePlace(2907285L, "다이소 제주연동점", null, null, "UNKNOWN", "UNKNOWN", false));
        assertThat(override(PetAllowanceType.NOT_ALLOWED).applyTo(daiso))
            .isEqualTo(new OverridablePlace(2907285L, "다이소 제주연동점", null, null, "NOT_ALLOWED", "UNKNOWN", false));
        assertThat(override(PetAllowanceType.PARTIALLY_ALLOWED).applyTo(daiso))
            .isEqualTo(new OverridablePlace(2907285L, "다이소 제주연동점", null, null, "PARTIALLY_ALLOWED", "ALL", true));
        // 동반 구분은 맞는데 pet_available 만 어긋나도 결과가 다르다 — 쓸 것이 있다
        OverridablePlace mismatched = new OverridablePlace(2907285L, "다이소 제주연동점", null, null, "UNKNOWN", "UNKNOWN", true);
        assertThat(override(PetAllowanceType.UNKNOWN).applyTo(mismatched)).isNotEqualTo(mismatched);
    }

    @Test
    @DisplayName("reason · evidence 가 비면 만들지 않는다")
    void rejectsMissingReasonOrEvidence() {
        assertInvalid(() -> new PlaceOverride(1L, "한림공원", false, null, null, " ", EVIDENCE));
        assertInvalid(() -> new PlaceOverride(1L, "한림공원", false, null, null, null, EVIDENCE));
        assertInvalid(() -> new PlaceOverride(1L, "한림공원", false, null, null, "야외", List.of()));
        assertInvalid(() -> new PlaceOverride(1L, "한림공원", false, null, null, "야외", null));
        assertInvalid(() -> new PlaceOverride(1L, "한림공원", false, null, null, "야외", List.of("근거", " ")));
    }

    @Test
    @DisplayName("id · 기대 제목이 없거나 바꿀 칸이 하나도 없으면 만들지 않는다")
    void rejectsMissingTargetOrNoColumn() {
        assertInvalid(() -> new PlaceOverride(0L, "한림공원", false, null, null, "야외", EVIDENCE));
        assertInvalid(() -> new PlaceOverride(1L, "", false, null, null, "야외", EVIDENCE));
        assertInvalid(() -> new PlaceOverride(1L, null, false, null, null, "야외", EVIDENCE));
        assertInvalid(() -> new PlaceOverride(1L, "한림공원", null, null, null, "야외", EVIDENCE));
    }

    private static PlaceOverride override(PetAllowanceType allowance) {
        return new PlaceOverride(2907285L, "다이소 제주연동점", null, null, allowance, "원천끼리 어긋난다", EVIDENCE);
    }

    private static void assertInvalid(org.assertj.core.api.ThrowableAssert.ThrowingCallable callable) {
        assertThatThrownBy(callable)
            .isInstanceOf(PlaceImportException.class)
            .extracting(exception -> ((PlaceImportException) exception).getErrorCode())
            .isEqualTo(PlaceImportErrorCode.PLACE_OVERRIDE_INVALID);
    }
}
