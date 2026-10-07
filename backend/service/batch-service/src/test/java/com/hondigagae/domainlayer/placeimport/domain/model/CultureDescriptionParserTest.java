package com.hondigagae.domainlayer.placeimport.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 문화정보원 장소설명 → 개요 (#1216). 값은 전부 2026-10 원본에서 그대로 옮겼다 —
 * 버리는 쪽(유형 표기)과 남기는 쪽(이용 메모)을 함께 밟는다.
 */
class CultureDescriptionParserTest {

    @Test
    @DisplayName("유형 표기 하나뿐이면 개요가 없다 — 용두암 · 수월봉의 관광지, 서귀포해양도립공원의 공원")
    void dropsTypeLabelOnly() {
        assertThat(CultureDescriptionParser.overviewOf("관광지")).isNull();
        assertThat(CultureDescriptionParser.overviewOf("공원")).isNull();
        assertThat(CultureDescriptionParser.overviewOf("애견 동반 펜션")).isNull();
        assertThat(CultureDescriptionParser.overviewOf("애견카페")).isNull();
        assertThat(CultureDescriptionParser.overviewOf("박물관")).isNull();
        assertThat(CultureDescriptionParser.overviewOf("문예회관")).isNull();
    }

    @Test
    @DisplayName("유형 표기 뒤의 이용 메모는 남긴다")
    void keepsMemoAfterTypeLabel() {
        assertThat(CultureDescriptionParser.overviewOf("관광지, 악천후 시 휴장")).isEqualTo("악천후 시 휴장");
        assertThat(CultureDescriptionParser.overviewOf("애견 동반 펜션, 애견수영장, 사전문의 필수"))
            .isEqualTo("애견수영장, 사전문의 필수");
        assertThat(CultureDescriptionParser.overviewOf("고양이 카페, 13세 이상 입장 가능"))
            .isEqualTo("13세 이상 입장 가능");
    }

    @Test
    @DisplayName("금액의 숫자 쉼표에서는 자르지 않는다")
    void keepsThousandsSeparator() {
        assertThat(CultureDescriptionParser.overviewOf("애견 동반 펜션, 사전문의 필수, 추가인원 15,000원"))
            .isEqualTo("사전문의 필수, 추가인원 15,000원");
        assertThat(CultureDescriptionParser.overviewOf("관광지, 파독광부 전시관 입장료 1,000원"))
            .isEqualTo("파독광부 전시관 입장료 1,000원");
    }

    @Test
    @DisplayName("첫 토막이 유형 표기가 아니면 버리지 않는다 — 사실을 잃는다")
    void keepsFirstPartWhenItIsNotTypeLabel() {
        assertThat(CultureDescriptionParser.overviewOf("상주견 있음")).isEqualTo("상주견 있음");
        assertThat(CultureDescriptionParser.overviewOf("예약제, 노키즈존")).isEqualTo("예약제, 노키즈존");
        assertThat(CultureDescriptionParser.overviewOf("동물원")).isEqualTo("동물원");
    }

    @Test
    @DisplayName("비었거나 쉼표뿐이면 개요가 없다")
    void returnsNullForBlank() {
        assertThat(CultureDescriptionParser.overviewOf(null)).isNull();
        assertThat(CultureDescriptionParser.overviewOf("  ")).isNull();
        assertThat(CultureDescriptionParser.overviewOf("관광지, ")).isNull();
    }
}
