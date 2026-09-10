package com.hondigagae.domainlayer.place.application.model;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class PlaceKeywordTest {

    @Test
    @DisplayName("null·공백은 필터 없음이다")
    void blankIsAbsent() {
        assertThat(PlaceKeyword.normalize(null)).isEmpty();
        assertThat(PlaceKeyword.normalize("")).isEmpty();
        assertThat(PlaceKeyword.normalize("   ")).isEmpty();
    }

    @Test
    @DisplayName("앞뒤 공백을 지우고 가운데 공백은 한 칸으로 접는다")
    void trimsAndCollapsesWhitespace() {
        assertThat(PlaceKeyword.normalize("  성산  일출  ")).contains("성산 일출");
    }

    @Test
    @DisplayName("LIKE 특수문자는 리터럴로 이스케이프한다")
    void escapesLikeMetacharacters() {
        assertThat(PlaceKeyword.escapeLike("100%_카페\\")).isEqualTo("100\\%\\_카페\\\\");
    }
}
