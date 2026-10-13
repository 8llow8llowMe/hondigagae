package com.hondigagae.domainlayer.planner.application.model;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.shared.travel.place.AllowedPetSize;
import com.hondigagae.shared.travel.pet.PetSizeType;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 동행견 입장 판정 (#1420).
 *
 * <p>운영에서 보리(웰시코기 · 중형견 · 체중 미상) + 몽실이(말티즈 · 소형견 3.2kg) 일정 3일차에 한림공원
 * ({@code SMALL_ONLY}, "7kg 이하")이 들어갔다. 프롬프트 지시만 있고 서버 검증이 없었다. 판정은 tour-service 검색 필터와
 * 같은 규칙이어야 한다 — 크기는 {@link AllowedPetSize#allows}, 체중은 {@code weight <= maxPetWeightKg}.
 *
 * <p>체중을 모르는 아이는 크기 구간의 하한(중형견 10kg · 대형견 25kg)을 체중으로 쓴다. 보리는 정의상 10kg 이상이라 "7kg 이하"
 * 장소에 확실히 못 들어간다 — 추정이 아니라 core {@link PetSizeType} 의 경계라 과잉 배제가 없다.
 *
 * <p>검색 파라미터로 바꾸는 일(올림 · 1~100)은 어댑터의 몫이라 {@code PlaceCandidateClientAdapterTest} 가 본다.
 */
class PetAdmissionTest {

    /** 운영 사례의 두 마리. 보리는 체중을 적지 않았다. */
    private static final PetCondition BORI = PetCondition.builder().breed("웰시코기").sizeType(PetSizeType.MEDIUM).build();
    private static final PetCondition MONGSIL = PetCondition.builder()
        .breed("말티즈").sizeType(PetSizeType.SMALL).weightKg(new BigDecimal("3.2")).build();

    @Test
    @DisplayName("중형견 + 소형견 3.2kg 이면 소형견만 가능한 곳은 갈 수 없고 중소형견 가능한 곳은 갈 수 있다 — 한림공원 사례")
    void largestPetDecidesTheSize() {
        PetAdmission admission = PetAdmission.of(List.of(BORI, MONGSIL));

        assertThat(admission.admits(AllowedPetSize.SMALL_ONLY, 7)).isFalse();
        assertThat(admission.admits(AllowedPetSize.SMALL_MEDIUM, null)).isTrue();
        assertThat(admission.admits(candidate(AllowedPetSize.SMALL_ONLY, 7))).isFalse();
        // 체중 미상 보리의 하한 10kg 이 몽실이 3.2kg 보다 무겁다 — 중소형견이어도 7kg 이하는 갈 수 없다
        assertThat(admission.admits(AllowedPetSize.SMALL_MEDIUM, 7)).isFalse();
        assertThat(admission.sizeType()).isEqualTo(PetSizeType.MEDIUM);
        assertThat(admission.weightKg()).isEqualByComparingTo("10");
    }

    @Test
    @DisplayName("크기 구간의 하한은 core PetSizeType 의 경계와 같다 — 어긋나면 하한이 과잉 배제하거나 놓친다")
    void lowerBoundsMatchCoreSizeBoundaries() {
        for (PetSizeType size : List.of(PetSizeType.MEDIUM, PetSizeType.LARGE)) {
            BigDecimal lowerBound = PetAdmission.lowerBoundKg(size);

            assertThat(PetSizeType.fromWeight(lowerBound)).as("하한 %s kg 은 %s 다", lowerBound, size).isEqualTo(size);
            assertThat(PetSizeType.fromWeight(lowerBound.subtract(new BigDecimal("0.01"))))
                .as("하한 바로 아래는 %s 가 아니다", size).isNotEqualTo(size);
        }
        // 소형견은 하한이 없다 — 체중을 모르면 체중으로 막지 않는다
        assertThat(PetAdmission.lowerBoundKg(PetSizeType.SMALL)).isNull();
        assertThat(PetAdmission.lowerBoundKg(null)).isNull();
    }

    @Test
    @DisplayName("체중을 모르는 중형견은 하한 10kg 으로 판정한다 — 크기를 받아 주는 곳이어도 7kg 이하는 갈 수 없고 10kg 이하는 갈 수 있다")
    void unknownWeightUsesSizeLowerBound() {
        PetAdmission admission = PetAdmission.of(List.of(BORI));

        assertThat(admission.admits(AllowedPetSize.ALL, 7)).isFalse();
        assertThat(admission.admits(AllowedPetSize.UNKNOWN, 7)).isFalse();
        assertThat(admission.admits(AllowedPetSize.ALL, 10)).isTrue();
        assertThat(admission.admits(AllowedPetSize.SMALL_ONLY, null)).isFalse();
        assertThat(admission.weightKg()).isEqualByComparingTo("10");
    }

    @Test
    @DisplayName("체중을 모르는 대형견은 하한 25kg, 소형견은 하한이 없어 체중으로 막지 않는다")
    void lowerBoundPerSize() {
        PetAdmission large = PetAdmission.of(List.of(PetCondition.builder().sizeType(PetSizeType.LARGE).build()));
        PetAdmission small = PetAdmission.of(List.of(PetCondition.builder().sizeType(PetSizeType.SMALL).build()));

        assertThat(large.admits(AllowedPetSize.ALL, 24)).isFalse();
        assertThat(large.admits(AllowedPetSize.ALL, 25)).isTrue();
        assertThat(small.admits(AllowedPetSize.SMALL_ONLY, 1)).isTrue();
        assertThat(small.weightKg()).isNull();
    }

    @Test
    @DisplayName("체중을 아는 아이에게는 하한을 쓰지 않는다 — 8kg 인데 중형견으로 저장된 불일치 데이터를 과잉 배제하지 않는다")
    void knownWeightIgnoresLowerBound() {
        PetAdmission admission = PetAdmission.of(List.of(
            PetCondition.builder().sizeType(PetSizeType.MEDIUM).weightKg(new BigDecimal("8")).build()));

        assertThat(admission.admits(AllowedPetSize.ALL, 9)).isTrue();
        assertThat(admission.weightKg()).isEqualByComparingTo("8");
        // 크기는 저장된 크기로 판정한다
        assertThat(admission.admits(AllowedPetSize.SMALL_ONLY, null)).isFalse();
    }

    @Test
    @DisplayName("체중 상한은 포함이다 — 7.0kg 은 7kg 이하에 들어가고 7.3kg 은 못 들어간다")
    void weightLimitIsInclusive() {
        PetAdmission exact = PetAdmission.of(List.of(small("7.0")));
        PetAdmission over = PetAdmission.of(List.of(small("7.3")));

        assertThat(exact.admits(AllowedPetSize.SMALL_ONLY, 7)).isTrue();
        assertThat(over.admits(AllowedPetSize.SMALL_ONLY, 7)).isFalse();
        // 상한이 없으면 체중으로는 막지 않는다
        assertThat(over.admits(AllowedPetSize.SMALL_ONLY, null)).isTrue();
    }

    @Test
    @DisplayName("장소 크기가 정보 없음 · null 이면 들어갈 수 있다 — 모르는 것을 불가로 단정하지 않는다")
    void unknownPlaceSizeAdmits() {
        PetAdmission admission = PetAdmission.of(List.of(PetCondition.builder().sizeType(PetSizeType.LARGE).build()));

        assertThat(admission.admits(AllowedPetSize.UNKNOWN, null)).isTrue();
        assertThat(admission.admits(null, null)).isTrue();
        assertThat(admission.admits(AllowedPetSize.SMALL_MEDIUM, null)).isFalse();
    }

    @Test
    @DisplayName("반려견 정보가 없으면 아무 장소도 막지 않고 검색 조건도 걸지 않는다")
    void noPetsAdmitsEverything() {
        PetAdmission admission = PetAdmission.of(List.of());

        assertThat(admission).isEqualTo(PetAdmission.ANY);
        assertThat(PetAdmission.of(null)).isEqualTo(PetAdmission.ANY);
        assertThat(admission.admits(AllowedPetSize.SMALL_ONLY, 1)).isTrue();
        assertThat(admission.sizeType()).isNull();
        assertThat(admission.weightKg()).isNull();
    }

    @Test
    @DisplayName("크기 없이 체중 12kg 만 있으면 중형견으로 판정한다")
    void derivesSizeFromWeight() {
        PetAdmission admission = PetAdmission.of(List.of(PetCondition.builder().weightKg(new BigDecimal("12")).build()));

        assertThat(admission.sizeType()).isEqualTo(PetSizeType.MEDIUM);
        assertThat(admission.admits(AllowedPetSize.SMALL_ONLY, null)).isFalse();
        assertThat(admission.admits(AllowedPetSize.SMALL_MEDIUM, 15)).isTrue();
    }

    @Test
    @DisplayName("여러 마리면 가장 무거운 유효 체중을 쓴다")
    void heaviestEffectiveWeightWins() {
        assertThat(PetAdmission.of(List.of(MONGSIL, small("7.0"))).weightKg()).isEqualByComparingTo("7.0");
        assertThat(PetAdmission.of(List.of(MONGSIL)).weightKg()).isEqualByComparingTo("3.2");
    }

    @Test
    @DisplayName("여러 마리면 가장 큰 크기를 쓴다")
    void largestSizeWins() {
        PetCondition large = PetCondition.builder().sizeType(PetSizeType.LARGE).build();

        assertThat(PetAdmission.of(List.of(MONGSIL, BORI)).sizeType()).isEqualTo(PetSizeType.MEDIUM);
        assertThat(PetAdmission.of(List.of(MONGSIL, large, BORI)).sizeType()).isEqualTo(PetSizeType.LARGE);
        assertThat(PetAdmission.of(List.of(MONGSIL)).sizeType()).isEqualTo(PetSizeType.SMALL);
    }

    private static PetCondition small(String weightKg) {
        return PetCondition.builder().sizeType(PetSizeType.SMALL).weightKg(new BigDecimal(weightKg)).build();
    }

    private static PlaceCandidate candidate(AllowedPetSize allowedPetSize, Integer maxPetWeightKg) {
        return PlaceCandidate.builder()
            .placeId(126455L).title("한림공원").allowedPetSize(allowedPetSize).maxPetWeightKg(maxPetWeightKg)
            .build();
    }
}
