package com.hondigagae.domainlayer.placeimport.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 식약처 휴게음식점 중 카페 이름 판정 (#1434). 예시 상호는 식약처 제주 등록 업소(고정물 {@code mfds_pet_restaurant.xlsx}) 실재 이름이다.
 */
class CafeNamePolicyTest {

    @Test
    @DisplayName("카페 · 커피 · coffee · cafe · café · 다방이 들어간 휴게음식점은 카페로 적재한다")
    void classifiesGenericCafeKeywords() {
        assertThat(CafeNamePolicy.sourceCategoryOf("휴게음식점", "내노키카페")).isEqualTo("카페");
        assertThat(CafeNamePolicy.sourceCategoryOf("휴게음식점", "현자커피")).isEqualTo("카페");
        assertThat(CafeNamePolicy.sourceCategoryOf("휴게음식점", "주식회사하소로커피")).isEqualTo("카페");
        assertThat(CafeNamePolicy.sourceCategoryOf("휴게음식점", "카페오복(cafeObok)")).isEqualTo("카페");
        assertThat(CafeNamePolicy.sourceCategoryOf("휴게음식점", "Jeju COFFEE Lab")).isEqualTo("카페");
        assertThat(CafeNamePolicy.sourceCategoryOf("휴게음식점", "CAFÉ 바람")).isEqualTo("카페");
        assertThat(CafeNamePolicy.sourceCategoryOf("휴게음식점", "애월다방")).isEqualTo("카페");
    }

    @Test
    @DisplayName("이름에 '커피' 가 없는 커피 체인도 카페다 — 커피빈제주애월DT점이 '휴게음식점' 으로 보이던 것")
    void classifiesCoffeeChains() {
        assertThat(CafeNamePolicy.sourceCategoryOf("휴게음식점", "커피빈제주애월DT점")).isEqualTo("카페");
        assertThat(CafeNamePolicy.sourceCategoryOf("휴게음식점", "스타벅스 제주애월DT점")).isEqualTo("카페");
        assertThat(CafeNamePolicy.sourceCategoryOf("휴게음식점", "투썸플레이스 제주노형점")).isEqualTo("카페");
        assertThat(CafeNamePolicy.sourceCategoryOf("휴게음식점", "이디야 서귀포점")).isEqualTo("카페");
        assertThat(CafeNamePolicy.sourceCategoryOf("휴게음식점", "메가엠지씨 제주연동점")).isEqualTo("카페");
        assertThat(CafeNamePolicy.sourceCategoryOf("휴게음식점", "빽다방 제주시청점")).isEqualTo("카페");
        assertThat(CafeNamePolicy.sourceCategoryOf("휴게음식점", "폴 바셋 제주점")).isEqualTo("카페");
        assertThat(CafeNamePolicy.sourceCategoryOf("휴게음식점", "탐앤탐스 탐스커버리")).isEqualTo("카페");
        assertThat(CafeNamePolicy.sourceCategoryOf("휴게음식점", "블루보틀 제주")).isEqualTo("카페");
        assertThat(CafeNamePolicy.sourceCategoryOf("휴게음식점", "매머드익스프레스 제주점")).isEqualTo("카페");
    }

    @Test
    @DisplayName("신호가 없는 이름은 원래 업종 그대로다 — 이름이 유일한 신호라 추측하지 않는다")
    void keepsBusinessTypeWithoutSignal() {
        assertThat(CafeNamePolicy.sourceCategoryOf("휴게음식점", "신창해물라면와랑식탁")).isEqualTo("휴게음식점");
        assertThat(CafeNamePolicy.sourceCategoryOf("휴게음식점", "양과자회관")).isEqualTo("휴게음식점");
        // 실제로는 카페일 수 있지만 이름만으로는 알 수 없다 — 한계로 남긴다
        assertThat(CafeNamePolicy.sourceCategoryOf("휴게음식점", "해피라떼클럽(HLC)")).isEqualTo("휴게음식점");
        assertThat(CafeNamePolicy.sourceCategoryOf("휴게음식점", "고양이있어요")).isEqualTo("휴게음식점");
    }

    @Test
    @DisplayName("휴게음식점이 아닌 업종에는 적용하지 않는다 — 일반음식점 · 제과점영업은 이름에 카페가 있어도 그대로다")
    void appliesOnlyToRestFoodBusinesses() {
        assertThat(CafeNamePolicy.sourceCategoryOf("일반음식점", "카페드라면")).isEqualTo("일반음식점");
        assertThat(CafeNamePolicy.sourceCategoryOf("제과점영업", "커피콩빵 애월점")).isEqualTo("제과점영업");
        assertThat(CafeNamePolicy.sourceCategoryOf(" 휴게 음식점 ", "현자커피")).isEqualTo("카페");
        assertThat(CafeNamePolicy.sourceCategoryOf(null, "현자커피")).isNull();
    }

    @Test
    @DisplayName("알려진 한계 — '다방' 이 낱말 속에 든 이름도 카페로 본다 (바다방갈로)")
    void knownLimitationOfDabangSubstring() {
        // 부분 문자열로 보므로 '바다 + 방갈로' 의 '다방' 에도 걸린다. 휴게음식점에만 적용해 범위를 좁혔다
        assertThat(CafeNamePolicy.sourceCategoryOf("휴게음식점", "바다방갈로")).isEqualTo("카페");
    }

    @Test
    @DisplayName("이름 정규화는 공백 제거 · 소문자다")
    void normalizesName() {
        assertThat(CafeNamePolicy.looksLikeCafe("Cafe  Obok")).isTrue();
        assertThat(CafeNamePolicy.looksLikeCafe("커 피 냅")).isTrue();
        assertThat(CafeNamePolicy.looksLikeCafe(null)).isFalse();
        assertThat(CafeNamePolicy.looksLikeCafe(" ")).isFalse();
    }
}
