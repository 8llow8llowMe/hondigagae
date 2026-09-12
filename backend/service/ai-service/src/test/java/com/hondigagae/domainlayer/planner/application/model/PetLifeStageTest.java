package com.hondigagae.domainlayer.planner.application.model;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class PetLifeStageTest {

    @Test
    @DisplayName("12개월 미만은 자견이다")
    void puppyUnderTwelveMonths() {
        assertThat(PetLifeStage.fromAgeMonths(0)).isEqualTo(PetLifeStage.PUPPY);
        assertThat(PetLifeStage.fromAgeMonths(11)).isEqualTo(PetLifeStage.PUPPY);
    }

    @Test
    @DisplayName("12개월부터 84개월 직전까지는 성견이다 — 6살 말티즈가 노령견으로 불리던 것이 이 구간이다 (#493)")
    void adultBetweenOneAndSeven() {
        assertThat(PetLifeStage.fromAgeMonths(12)).isEqualTo(PetLifeStage.ADULT);
        // dev 재현에 쓴 반려견: 2020-01 생 6살 말티즈
        assertThat(PetLifeStage.fromAgeMonths(72)).isEqualTo(PetLifeStage.ADULT);
        assertThat(PetLifeStage.fromAgeMonths(83)).isEqualTo(PetLifeStage.ADULT);
    }

    @Test
    @DisplayName("84개월(7년)부터 노령견이다 — 경계가 포함이다")
    void seniorFromSevenYears() {
        assertThat(PetLifeStage.fromAgeMonths(84)).isEqualTo(PetLifeStage.SENIOR);
        assertThat(PetLifeStage.fromAgeMonths(200)).isEqualTo(PetLifeStage.SENIOR);
    }

    @Test
    @DisplayName("나이를 모르면 단계도 없다 — 모르는 것을 성견이라고 단정하지 않는다")
    void nullAgeKeepsNull() {
        assertThat(PetLifeStage.fromAgeMonths(null)).isNull();
    }

    @Test
    @DisplayName("성견에는 활동 제약을 걸지 않는다 — 프롬프트에 빈 괄호를 남기지 않으려는 것이다")
    void adultHasNoGuidance() {
        assertThat(PetLifeStage.ADULT.getPlanningGuidance()).isNull();
        assertThat(PetLifeStage.PUPPY.getPlanningGuidance()).isNotBlank();
        assertThat(PetLifeStage.SENIOR.getPlanningGuidance()).isNotBlank();
    }
}
