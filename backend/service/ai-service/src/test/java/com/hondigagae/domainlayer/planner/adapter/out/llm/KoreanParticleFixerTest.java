package com.hondigagae.domainlayer.planner.adapter.out.llm;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * dev 실측 사례(#570)와 그 주변 경계를 고정한다.
 *
 * <p>프롬프트 규칙 9번이 이미 "장소명 뒤에 조사를 붙이지 말라" 고 지시하는데도 나온 출력이라,
 * 여기가 마지막 방어다.
 */
class KoreanParticleFixerTest {

    private static final List<String> CANDIDATES = List.of(
        "제주 애월코스트34", "애월한담공원", "노형", "노형수목원길", "카페 1100", "Dog Cafe", "협재해수욕장",
        "카페공작소(애월점)", "블루오션 Pension");

    @Test
    @DisplayName("숫자로 끝나는 장소명의 조사를 바로잡는다 — dev 실측 문장")
    void fixesParticleAfterNumericName() {
        String actual = KoreanParticleFixer.fix(
            "제주 애월코스트34은 소형견만 가능 체중제한 5kg이므로 우리 말티즈가 입장할 수 있어요.", CANDIDATES);

        // "34" 는 "삼십사" 라 받침이 없다
        assertThat(actual).isEqualTo(
            "제주 애월코스트34는 소형견만 가능 체중제한 5kg이므로 우리 말티즈가 입장할 수 있어요.");
    }

    @Test
    @DisplayName("숫자 읽기로 받침을 판정한다 — 0·1·3·6·7·8 은 받침 있음, 2·4·5·9 는 없음")
    void readsDigitsAsKorean() {
        // 1100 은 "천백" 이라 ㄱ 받침이다. 끝자리 0 만 봐도 십·백·천·만 중 하나라 언제나 받침이 있다
        assertThat(KoreanParticleFixer.fix("카페 1100는 넓어요.", CANDIDATES)).isEqualTo("카페 1100은 넓어요.");
    }

    @Test
    @DisplayName("맞게 붙은 조사는 그대로 둔다")
    void leavesCorrectParticlesAlone() {
        String text = "애월한담공원은 바다가 보여요. 협재해수욕장은 모래가 곱고요.";
        assertThat(KoreanParticleFixer.fix(text, CANDIDATES)).isEqualTo(text);
    }

    @Test
    @DisplayName("이/가 · 을/를 · 와/과도 본다")
    void fixesEveryParticlePair() {
        assertThat(KoreanParticleFixer.fix("제주 애월코스트34가 아니라", CANDIDATES))
            .isEqualTo("제주 애월코스트34가 아니라");
        assertThat(KoreanParticleFixer.fix("제주 애월코스트34이 아니라", CANDIDATES))
            .isEqualTo("제주 애월코스트34가 아니라");
        assertThat(KoreanParticleFixer.fix("제주 애월코스트34을 들러요.", CANDIDATES))
            .isEqualTo("제주 애월코스트34를 들러요.");
        assertThat(KoreanParticleFixer.fix("제주 애월코스트34과 함께", CANDIDATES))
            .isEqualTo("제주 애월코스트34와 함께");
    }

    /*
     * 한국어 도로명이 문자 그대로 `<지명>+로` 라서, 지명이 후보 제목이면 `노형로 12` 의 `로` 가
     * 조사로 잡혀 `노형으로 12` 가 된다. 뒤 글자를 보는 가드로는 막을 수 없는 구조적 충돌이라
     * 쌍 자체를 뺐다.
     */
    @Test
    @DisplayName("으로/로 는 일부러 고치지 않는다 — 도로명을 깨뜨린다")
    void neverTouchesEuroRo() {
        assertThat(KoreanParticleFixer.fix("제주시 노형로 12 로 가요.", CANDIDATES))
            .isEqualTo("제주시 노형로 12 로 가요.");
        assertThat(KoreanParticleFixer.fix("애월한담공원로 이동해요.", CANDIDATES))
            .isEqualTo("애월한담공원로 이동해요.");
    }

    /*
     * 가드가 없으면 "노형" 이 후보일 때 "노형은하수공원" 이 "노형는하수공원" 이 된다.
     * 조사로 보려면 그 다음 글자가 한글이 아니어야 한다.
     */
    @Test
    @DisplayName("장소명 뒤 글자가 낱말의 일부면 조사로 보지 않는다")
    void doesNotTouchWordsThatStartWithAParticleSyllable() {
        String text = "노형은하수공원에서 산책해요.";
        assertThat(KoreanParticleFixer.fix(text, CANDIDATES)).isEqualTo(text);
    }

    @Test
    @DisplayName("긴 이름을 먼저 본다 — 짧은 이름이 긴 이름 안에서 잡히면 안 된다")
    void prefersLongerNames() {
        // "노형" 과 "노형수목원길" 이 둘 다 후보다. 짧은 쪽을 먼저 잡으면 이름 중간을 건드린다.
        assertThat(KoreanParticleFixer.fix("노형수목원길은 그늘이 많아요.", CANDIDATES))
            .isEqualTo("노형수목원길은 그늘이 많아요.");
    }

    @Test
    @DisplayName("후보에 없는 이름은 손대지 않는다 — 모델이 쓴 일반 문장까지 고치지 않는다")
    void ignoresTextOutsideCandidateNames() {
        String text = "산책은 좋지만 한라산은 반려견 출입이 어려워요.";
        assertThat(KoreanParticleFixer.fix(text, CANDIDATES)).isEqualTo(text);
    }

    /*
     * **이 클래스는 이미 붙어 있는 조사를 덮어쓴다.** 프론트 `korean.ts` 처럼 "판정 불가 = 받침 없음"
     * 으로 두면, 빗나갔을 때 맞던 문장이 틀린 문장이 된다 — 고치려는 버그와 같은 종류다.
     * `Pension` 은 읽으면 "펜션"(ㄴ 받침)이라 `은` 이 맞고, `)` 로는 아무것도 알 수 없다.
     */
    @Test
    @DisplayName("받침을 모르면 손대지 않는다 — 괄호·영문으로 끝나는 제목")
    void leavesUndecidableEndingsAlone() {
        assertThat(KoreanParticleFixer.fix("카페공작소(애월점)은 실내예요.", CANDIDATES))
            .isEqualTo("카페공작소(애월점)은 실내예요.");
        assertThat(KoreanParticleFixer.fix("블루오션 Pension은 조용해요.", CANDIDATES))
            .isEqualTo("블루오션 Pension은 조용해요.");
        // 반대 방향으로도 안 건드린다 — 원문을 그대로 둔다
        assertThat(KoreanParticleFixer.fix("Dog Cafe은 실내예요.", CANDIDATES))
            .isEqualTo("Dog Cafe은 실내예요.");
    }

    @Test
    @DisplayName("한 문장에 같은 이름이 여러 번 나와도 모두 고친다")
    void fixesEveryOccurrence() {
        assertThat(KoreanParticleFixer.fix("제주 애월코스트34은 숙소예요. 제주 애월코스트34은 조용해요.", CANDIDATES))
            .isEqualTo("제주 애월코스트34는 숙소예요. 제주 애월코스트34는 조용해요.");
    }

    @Test
    @DisplayName("문장 끝에 조사가 붙어도 고친다")
    void fixesParticleAtEndOfText() {
        assertThat(KoreanParticleFixer.fix("추천하는 곳은 제주 애월코스트34은", CANDIDATES))
            .isEqualTo("추천하는 곳은 제주 애월코스트34는");
    }

    @Test
    @DisplayName("null · 빈 값 · 후보 없음은 그대로 돌려준다")
    void isTotal() {
        assertThat(KoreanParticleFixer.fix(null, CANDIDATES)).isNull();
        assertThat(KoreanParticleFixer.fix("  ", CANDIDATES)).isEqualTo("  ");
        assertThat(KoreanParticleFixer.fix("제주 애월코스트34은", List.of())).isEqualTo("제주 애월코스트34은");
        assertThat(KoreanParticleFixer.fix("제주 애월코스트34은", null)).isEqualTo("제주 애월코스트34은");
    }
}
