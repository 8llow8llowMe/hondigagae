package com.hondigagae.domainlayer.planner.application.model;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * 요청 문구의 실내 · 카페 (#1170 · #1423). 낱말이 들어 있기만 하면 요청으로 읽어서 "카페 말고 바다 위주로" 에도 날마다
 * 카페를 넣고 "요청하신 카페를 날마다 넣었어요" 라고 했다.
 */
class RequestNoteConstraintsTest {

    @Test
    @DisplayName("실측 문구는 실내와 카페를 함께 묻는다")
    void readsTheMeasuredNote() {
        RequestNoteConstraints constraints = RequestNoteConstraints.from("오전엔 바다 보며 산책하고 오후엔 실내 카페에서 쉬고 싶어요");

        assertThat(constraints.cafe()).isTrue();
        assertThat(constraints.indoor()).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"카페 말고 바다 위주로", "카페는 별로예요", "카페는 싫어요", "카페 빼고 짜 주세요", "실내는 제외하고 야외 위주로",
        "실내 카페 말고 바다 보고 싶어요"})
    @DisplayName("바로 뒤에서 부정된 낱말은 묻지 않는다 — 공백만 사이에 둔 \"실내 카페\" 는 한 말이라 함께 부정된다")
    void negatedWordsAreNotRequests(String note) {
        assertThat(RequestNoteConstraints.from(note).asksAnything()).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {"실내견이라 바다 위주로", "실내 배변만 해요", "실내 생활하는 아이예요"})
    @DisplayName("반려견이 사는 방식을 말하는 실내(실내견 · 실내 배변 · 실내 생활)는 장소 조건이 아니다")
    void petHabitIsNotAnIndoorRequest(String note) {
        assertThat(RequestNoteConstraints.from(note).indoor()).isFalse();
    }

    @Test
    @DisplayName("부정은 바로 앞 낱말에만 걸리고, 여러 번 나오면 하나라도 부정되지 않았으면 묻는 것이다")
    void negationAppliesToTheWordJustBefore() {
        RequestNoteConstraints indoorOnly = RequestNoteConstraints.from("카페 말고 실내 위주로");
        assertThat(indoorOnly.cafe()).isFalse();
        assertThat(indoorOnly.indoor()).isTrue();

        RequestNoteConstraints clauses = RequestNoteConstraints.from("카페는 싫고, 실내에서 쉬고 싶어요");
        assertThat(clauses.cafe()).isFalse();
        assertThat(clauses.indoor()).isTrue();

        assertThat(RequestNoteConstraints.from("첫날은 카페 말고 바다, 둘째 날 오후엔 카페에서 쉬어요").cafe()).isTrue();
        assertThat(RequestNoteConstraints.from("실내견이라 실내 카페에서 쉬고 싶어요").indoor()).isTrue();
    }

    @Test
    @DisplayName("\"아니면\" 은 부정이 아니다")
    void alternativeIsNotNegation() {
        assertThat(RequestNoteConstraints.from("카페 아니면 공원도 좋아요").cafe()).isTrue();
        assertThat(RequestNoteConstraints.from("카페가 아니라 공원으로").cafe()).isFalse();
    }

    @Test
    @DisplayName("마침표 없이 이어 쓴 다음 문장의 부정은 앞 문장의 낱말에 걸리지 않는다 — 해요체 문장 끝에서 끊는다")
    void negationStopsAtTheEndOfAHaeyoSentence() {
        assertThat(RequestNoteConstraints.from("실내 위주로 해주세요 더위 싫어해서").indoor()).isTrue();
        assertThat(RequestNoteConstraints.from("카페 좋아해요 시끄러운 곳은 싫어요").cafe()).isTrue();
        assertThat(RequestNoteConstraints.from("카페 가고 싶어요 바다는 별로").cafe()).isTrue();
    }

    @Test
    @DisplayName("실내 견학은 장소 요청이고, 줄바꿈을 사이에 둔 낱말은 한 말로 묶지 않는다")
    void phraseBoundaries() {
        assertThat(RequestNoteConstraints.from("실내 견학 가능한 곳").indoor()).isTrue();

        RequestNoteConstraints lines = RequestNoteConstraints.from("1일차 애견카페\n실내 말고 야외");
        assertThat(lines.cafe()).isTrue();
        assertThat(lines.indoor()).isFalse();
    }
}
