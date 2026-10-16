package com.hondigagae.domainlayer.place.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * 반려동물 제한사항 원문 해석 검증 (#1523).
 *
 * <p>여기서 고정하는 것은 두 갈래다 — <b>"제한 없음" 을 뜻하는 원천 자리표시가 제한사항처럼 내려가지 않는 것</b>과
 * <b>실제 제한 원문은 한 글자도 잃지 않는 것</b>. 앞쪽이 깨지면 장소 상세에 "해당없음" 이 제한사항으로 뜨고,
 * 뒤쪽이 깨지면 "야외만 반려동물 동반 가능" 같은 실제 제한이 화면에서 사라진다.
 */
class PetRestrictionTest {

    @Test
    @DisplayName("null 은 null 이다")
    void nullStaysNull() {
        assertThat(PetRestriction.stated(null)).isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " ", "   ", "\t", "\n", " ", "　", "  　 "})
    @DisplayName("빈 값 · 공백뿐인 값은 null 이다 — NBSP · 전각 공백도 공백이다")
    void blankIsNull(String raw) {
        assertThat(PetRestriction.stated(raw)).isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {"해당없음", "제한사항 없음"})
    @DisplayName("원천의 '제한 없음' 자리표시는 null 이다 (dev 노출 행 실측: 제한사항 없음 68 · 해당없음 58)")
    void placeholdersAreNull(String raw) {
        assertThat(PetRestriction.stated(raw)).isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {"해당 없음", "제한사항없음", "제한 사항 없음", "  해당없음  ", "해 당 없 음", "제한사항 없음", "해당　없음"})
    @DisplayName("자리표시는 공백 차이를 무시하고 비교한다")
    void placeholdersIgnoreSpacing(String raw) {
        assertThat(PetRestriction.stated(raw)).isNull();
    }

    @Test
    @DisplayName("실제 제한 원문은 그대로다")
    void plainRestrictionIsKept() {
        assertThat(PetRestriction.stated("야외만 반려동물 동반 가능")).isEqualTo("야외만 반려동물 동반 가능");
        assertThat(PetRestriction.stated("객실당 최대 2마리")).isEqualTo("객실당 최대 2마리");
        assertThat(PetRestriction.stated("케이지 이용")).isEqualTo("케이지 이용");
    }

    @Test
    @DisplayName("앞뒤 공백만 정리하고 안쪽 공백은 건드리지 않는다")
    void onlyEdgeSpacesAreTrimmed() {
        assertThat(PetRestriction.stated("  목줄, 배변봉투 \n")).isEqualTo("목줄, 배변봉투");
        assertThat(PetRestriction.stated(" 케이지,  안기　")).isEqualTo("케이지,  안기");
    }

    @Test
    @DisplayName("쉼표 목록은 쪼개지 않고 한 문자열 그대로다")
    void commaListIsNotSplit() {
        assertThat(PetRestriction.stated("야외만 동반 가능, 목줄, 배변봉투, 대형견 입마개"))
            .isEqualTo("야외만 동반 가능, 목줄, 배변봉투, 대형견 입마개");
        assertThat(PetRestriction.stated("수요일만 가능, 케이지, 목줄")).isEqualTo("수요일만 가능, 케이지, 목줄");
    }

    @Test
    @DisplayName("자리표시를 품은 문장은 자리표시가 아니다 — 정확히 그 낱말일 때만 지운다")
    void phraseContainingPlaceholderIsKept() {
        // 원문을 지우는 쪽으로 틀리면 실제 제한이 화면에서 사라진다. 일치만 본다.
        assertThat(PetRestriction.stated("대형견 해당없음, 소형견만 가능")).isEqualTo("대형견 해당없음, 소형견만 가능");
        assertThat(PetRestriction.stated("실내 제한사항 없음, 야외 목줄")).isEqualTo("실내 제한사항 없음, 야외 목줄");
    }

    @Test
    @DisplayName("실측에 없는 다른 부정 낱말은 넓혀 지우지 않는다")
    void otherNegationsAreKept() {
        assertThat(PetRestriction.stated("없음")).isEqualTo("없음");
    }
}
