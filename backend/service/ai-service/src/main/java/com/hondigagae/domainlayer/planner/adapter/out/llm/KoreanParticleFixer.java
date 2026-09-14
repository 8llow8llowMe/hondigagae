package com.hondigagae.domainlayer.planner.adapter.out.llm;

import java.util.Collection;
import java.util.Comparator;
import java.util.List;

/**
 * 모델이 <b>장소명 뒤에 잘못 붙인 조사</b>를 바로잡는다.
 *
 * <p>dev 실측 (#570):
 *
 * <pre>
 * 제주 애월코스트34은 소형견만 가능 체중제한 5kg이므로 ...
 *                 ^^ "34" 는 "삼십사" 로 읽어 받침이 없다 → "34는"
 * </pre>
 *
 * <h2>왜 프롬프트로 못 막는가</h2>
 *
 * <p>{@link AiPlanPromptFactory} 의 시스템 프롬프트 9번이 <b>이 사례를 그대로 인용해</b> "장소명 뒤에
 * 조사를 붙이지 말라" 고 이미 지시하고 있다. 그런데도 나왔다 — 규칙이 없어서가 아니라 <b>모델이
 * 규칙을 어긴 것</b>이라, 프롬프트를 더 세게 쓰는 것으로는 확정적으로 못 막는다. 프롬프트가 1차
 * 방어, 여기가 마지막 방어다 ({@link LlmTextCleaner} 와 같은 결이다).
 *
 * <h2>무엇만 고치는가</h2>
 *
 * <p><b>후보 목록에 있는 장소명 바로 뒤</b>에 붙은 조사만 고친다. 문장 전체의 조사를 훑지 않는다 —
 * 모델이 쓴 일반 문장까지 손대기 시작하면 고치는 것보다 망가뜨리는 것이 많아진다.
 *
 * <p>조사로 보려면 <b>조사 다음 글자가 한글이 아니어야</b> 한다. 이 가드가 없으면
 * {@code 노형} 이 후보일 때 {@code "노형은하수공원"} 이 {@code "노형는하수공원"} 이 된다.
 *
 * <h2>숫자 읽기</h2>
 *
 * <p>프론트의 {@code lib/text/korean.ts} 는 숫자 읽기를 <b>일부러 하지 않는다</b> — 거기서 다루는
 * 것은 사용자가 입력한 반려견 이름이라 한글이 압도적이어서다. 여기는 반대다. 이 버그를 낸 이름이
 * {@code 애월코스트34} 이므로 <b>숫자 읽기가 없으면 고칠 수가 없다.</b>
 */
final class KoreanParticleFixer {

    private static final char HANGUL_BASE = 0xAC00;
    private static final char HANGUL_LAST = 0xD7A3;
    private static final int JONGSEONG_COUNT = 28;

    /** 마지막 글자의 받침 상태. */
    private enum Ending {
        /** 받침 없음 — {@code 는} · {@code 가} · {@code 를} · {@code 와} */
        NONE,
        /** 그 밖의 받침 — {@code 은} · {@code 이} · {@code 을} · {@code 과} */
        OTHER,
        /**
         * 판정할 수 없음 — 이때는 <b>손대지 않는다.</b>
         *
         * <p>프론트 {@code lib/text/korean.ts} 는 판정 불가를 "받침 없음" 으로 본다. <b>여기서 그렇게
         * 하면 안 된다</b> — 저쪽은 조사가 <i>없는</i> 자리에 새로 붙이므로 빗나가도 본전이지만,
         * 여기는 <b>이미 붙어 있는 조사를 덮어쓴다.</b> 빗나가면 맞던 문장이 틀린 문장이 되고,
         * 그건 이 클래스가 고치려는 버그와 정확히 같은 종류다.
         *
         * <p>실제로 걸리는 입력이 있다. 후보 제목은 tour-service 원문 그대로라
         * {@code 카페공작소(애월점)} 처럼 괄호로 끝나거나 {@code ...Pension} 처럼 영문으로 끝난다.
         * 앞은 {@code )} 라 아무것도 알 수 없고, 뒤는 읽으면 "펜션"(ㄴ 받침)이라 오히려 받침이 있다.
         */
        UNKNOWN
    }

    /** 조사 짝. */
    private record Particle(String withJong, String withoutJong) {

        String correctFor(Ending ending) {
            return ending == Ending.OTHER ? withJong : withoutJong;
        }
    }

    /**
     * 고치는 조사.
     *
     * <p><b>{@code 으로}/{@code 로} 는 일부러 뺐다.</b> 한국어 도로명이 문자 그대로
     * {@code <지명>+로} 라서, 지명이 후보 제목이면 {@code "노형로 12"} 의 {@code 로} 가 조사로 잡혀
     * {@code "노형으로 12"} 가 된다 — 뒤 글자를 보는 가드로는 막을 수 없는 구조적 충돌이다.
     * 보고된 것도, 프롬프트 규칙 9번이 나열한 것도 {@code 은/는 · 이/가 · 을/를} 뿐이라
     * 이 쌍은 애초에 범위 밖이다.
     */
    private static final List<Particle> PARTICLES = List.of(
        new Particle("은", "는"),
        new Particle("이", "가"),
        new Particle("을", "를"),
        new Particle("과", "와")
    );

    private KoreanParticleFixer() {
    }

    /**
     * @param text 모델이 돌려준 문장. null 이면 그대로 돌려준다
     * @param placeNames 후보 장소명. 이 이름 뒤에 붙은 조사만 고친다
     */
    static String fix(String text, Collection<String> placeNames) {
        if (text == null || text.isBlank() || placeNames == null || placeNames.isEmpty()) {
            return text;
        }

        /*
         * 긴 이름부터 본다. "애월한담공원" 과 "애월" 이 둘 다 후보일 때 짧은 쪽을 먼저 잡으면
         * 긴 이름의 중간에서 조사를 찾게 된다.
         */
        List<String> names = placeNames.stream()
            .filter(name -> name != null && !name.isBlank())
            .sorted(Comparator.comparingInt(String::length).reversed())
            .toList();

        String fixed = text;
        for (String name : names) {
            fixed = fixAfter(fixed, name);
        }
        return fixed;
    }

    private static String fixAfter(String text, String name) {
        StringBuilder out = new StringBuilder(text.length());
        Ending ending = endingOf(name);
        int cursor = 0;

        while (true) {
            int found = text.indexOf(name, cursor);
            if (found < 0) {
                out.append(text, cursor, text.length());
                return out.toString();
            }

            int afterName = found + name.length();
            out.append(text, cursor, afterName);
            cursor = afterName;

            // 받침을 모르면 덮어쓰지 않는다 — 원문이 맞았을 수 있다
            if (ending == Ending.UNKNOWN) {
                continue;
            }

            for (Particle particle : PARTICLES) {
                int length = matchedLength(text, afterName, particle);
                if (length == 0) {
                    continue;
                }
                out.append(particle.correctFor(ending));
                cursor = afterName + length;
                break;
            }
        }
    }

    /** 이 자리에 이 조사가 붙어 있으면 그 길이, 아니면 0. */
    private static int matchedLength(String text, int at, Particle particle) {
        for (String form : List.of(particle.withJong(), particle.withoutJong())) {
            if (!text.startsWith(form, at)) {
                continue;
            }
            int next = at + form.length();
            // 조사 다음이 한글이면 조사가 아니라 다음 낱말의 첫 글자다 — "노형" + "은하수공원"
            if (next >= text.length() || !isHangulSyllable(text.charAt(next))) {
                return form.length();
            }
        }
        return 0;
    }

    /**
     * 마지막 글자의 받침. 한글이면 종성으로, 숫자면 <b>읽는 소리</b>로 판정한다.
     *
     * <p>{@code 4} 는 "사" 라 받침이 없고 {@code 6} 은 "육" 이라 {@code ㄱ} 받침이다.
     * <b>한글도 숫자도 아니면 {@link Ending#UNKNOWN} 이고, 그때는 조사를 건드리지 않는다.</b>
     */
    private static Ending endingOf(String name) {
        String trimmed = name.strip();
        if (trimmed.isEmpty()) {
            return Ending.UNKNOWN;
        }

        char last = trimmed.charAt(trimmed.length() - 1);
        if (isHangulSyllable(last)) {
            return (last - HANGUL_BASE) % JONGSEONG_COUNT == 0 ? Ending.NONE : Ending.OTHER;
        }
        if (last >= '0' && last <= '9') {
            return digitEnding(last);
        }
        return Ending.UNKNOWN;
    }

    /**
     * 끝자리 숫자의 받침. <b>한자어 읽기 기준</b>이다 — 영(ㅇ)·일(ㄹ)·이·삼(ㅁ)·사·오·육(ㄱ)·
     * 칠(ㄹ)·팔(ㄹ)·구.
     *
     * <p><b>끝자리 하나만 봐도 된다.</b> 몇 자리든 마지막 음절은 끝자리가 정하기 때문이다 —
     * {@code 16}은 "십육"(ㄱ), {@code 100}은 "백"(ㄱ), {@code 21}은 "이십일"(ㄹ).
     * 0 으로 끝나면 십(ㅂ)·백(ㄱ)·천(ㄴ)·만(ㄴ) 중 하나라 언제나 받침이 있다.
     *
     * <p>{@code 은/는} 계열은 {@code ㄹ} 을 다른 받침과 같게 보므로 여기서 갈라 둘 필요가 없다.
     */
    private static Ending digitEnding(char digit) {
        return switch (digit) {
            case '0', '1', '3', '6', '7', '8' -> Ending.OTHER;
            default -> Ending.NONE;
        };
    }

    private static boolean isHangulSyllable(char c) {
        return c >= HANGUL_BASE && c <= HANGUL_LAST;
    }
}
