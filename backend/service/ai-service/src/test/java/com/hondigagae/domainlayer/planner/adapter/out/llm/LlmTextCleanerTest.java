package com.hondigagae.domainlayer.planner.adapter.out.llm;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * #233 — 준비물 이유에 프롬프트의 일차 표기 {@code [N일차]} 가 그대로 노출됐다.
 * dev 실호출에서 관찰된 문장을 그대로 입력으로 쓴다.
 */
class LlmTextCleanerTest {

    @Test
    @DisplayName("한 날짜의 대괄호 표기를 걷어낸다 — \"[4일차] 흐림\" 은 \"4일차 흐림\" 이다")
    void stripsBracketsAroundSingleDay() {
        String cleaned = LlmTextCleaner.clean("[4일차] 2026-09-12 흐림, 강수확률 40%로 비가 올 가능성이 있으므로 가볍게 대비");

        assertThat(cleaned).isEqualTo("4일차 2026-09-12 흐림, 강수확률 40%로 비가 올 가능성이 있으므로 가볍게 대비");
    }

    @Test
    @DisplayName("일차 범위는 \"1~3일차\" 로 접는다 — \"[1일차]~[3일차]\" 는 기계가 만든 티가 난다")
    void collapsesDayRange() {
        String cleaned = LlmTextCleaner.clean("[1일차]~[3일차] 구름많음으로 햇빛이 강할 수 있어 반려견 눈 보호 필요");

        assertThat(cleaned).isEqualTo("1~3일차 구름많음으로 햇빛이 강할 수 있어 반려견 눈 보호 필요");
    }

    @Test
    @DisplayName("범위 사이의 공백도 같은 꼴로 본다")
    void collapsesDayRangeWithSpaces() {
        assertThat(LlmTextCleaner.clean("2일차 ~ 3일차 비 예보")).isEqualTo("2~3일차 비 예보");
    }

    @Test
    @DisplayName("반려견 표기의 대괄호도 걷어낸다 — 문장 안에 남는 기호는 종류를 가리지 않는다")
    void stripsBracketsAroundPetLabel() {
        assertThat(LlmTextCleaner.clean("[반려견 2] 더위에 약함")).isEqualTo("반려견 2 더위에 약함");
    }

    @Test
    @DisplayName("대괄호가 없는 문장은 그대로다 — 문장을 다듬는 일은 여기 몫이 아니다")
    void leavesPlainSentenceUntouched() {
        String sentence = "2일차 강수확률 80%로 비가 예보돼 방수 재킷이 필요합니다.";

        assertThat(LlmTextCleaner.clean(sentence)).isEqualTo(sentence);
    }

    @Test
    @DisplayName("대괄호를 지우고 남은 겹공백은 하나로 줄인다")
    void collapsesRepeatedSpacesLeftBehind() {
        assertThat(LlmTextCleaner.clean("[ ] 물그릇  필수")).isEqualTo("물그릇 필수");
    }

    @Test
    @DisplayName("null 은 null 이다 — 없는 이유를 빈 문자열로 바꾸지 않는다")
    void keepsNull() {
        assertThat(LlmTextCleaner.clean(null)).isNull();
    }
}
