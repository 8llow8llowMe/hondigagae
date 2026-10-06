package com.hondigagae.domainlayer.place.application.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.place.application.exception.PlaceErrorCode;
import com.hondigagae.domainlayer.place.application.exception.PlaceException;
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
    @DisplayName("유니코드 공백도 앞뒤에서 제거하고 가운데는 한 칸으로 접는다")
    void normalizesUnicodeWhitespace() {
        assertThat(PlaceKeyword.normalize("\u00A0성산\u3000일출\u00A0")).contains("성산 일출");
        assertThat(PlaceKeyword.normalize("\u00A0\u3000")).isEmpty();
    }

    @Test
    @DisplayName("LIKE 특수문자는 리터럴로 이스케이프한다")
    void escapesLikeMetacharacters() {
        assertThat(PlaceKeyword.escapeLike("100%_카페\\")).isEqualTo("100\\%\\_카페\\\\");
    }

    @Test
    @DisplayName("정규화된 단어는 최대 5개까지 허용한다")
    void limitsNormalizedTokensToFive() {
        assertThat(PlaceKeyword.hasValidTokenCount("  하나  둘\t셋\n넷 다섯  ")).isTrue();
        assertThat(PlaceKeyword.hasValidTokenCount("하나 둘 셋 넷 다섯 여섯")).isFalse();
    }

    @Test
    @DisplayName("검색 경계에서 6개 단어를 PLACE_108 로 거부한다")
    void rejectsMoreThanFiveTokensForSearch() {
        assertThatThrownBy(() -> PlaceKeyword.normalizeForSearch("하나 둘 셋 넷 다섯 여섯"))
            .isInstanceOfSatisfying(PlaceException.class,
                exception -> assertThat(exception.getErrorCode())
                    .isEqualTo(PlaceErrorCode.KEYWORD_TOKEN_LIMIT_EXCEEDED));
    }
}
