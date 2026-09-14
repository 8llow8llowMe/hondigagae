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
    /** 종성 인덱스 8 = {@code ㄹ}. 으로/로 만 이 값을 따로 본다. */
    private static final int JONGSEONG_RIEUL = 8;

    /** 마지막 글자의 받침 상태. */
    private enum Ending {
        /** 받침 없음 — {@code 는} · {@code 가} · {@code 를} · {@code 와} · {@code 로} */
        NONE,
        /** 받침 {@code ㄹ} — 은/는 계열은 받침 있음과 같고, 으로/로 만 갈린다 */
        RIEUL,
        /** 그 밖의 받침 — {@code 은} · {@code 이} · {@code 을} · {@code 과} · {@code 으로} */
        OTHER
    }

    /**
     * 조사 짝. <b>긴 것을 먼저 본다</b> — {@code 으로} 를 {@code 로} 보다 뒤에 두면
     * {@code "공원으로"} 에서 {@code 로} 만 잡혀 {@code "공원으으로"} 가 된다.
     */
    private record Particle(String withJong, String withoutJong, boolean rieulCountsAsNone) {

        String correctFor(Ending ending) {
            if (ending == Ending.NONE) {
                return withoutJong;
            }
            if (ending == Ending.RIEUL && rieulCountsAsNone) {
                return withoutJong;
            }
            return withJong;
        }
    }

    private static final List<Particle> PARTICLES = List.of(
        // 받침 ㄹ 뒤에는 "으로" 가 아니라 "로" 다 — 서울로 / 제주로 / 공원으로
        new Particle("으로", "로", true),
        new Particle("은", "는", false),
        new Particle("이", "가", false),
        new Particle("을", "를", false),
        new Particle("과", "와", false)
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
     * <p>{@code 4} 는 "사" 라 받침이 없고 {@code 1} 은 "일" 이라 {@code ㄹ} 받침이다.
     * 한글도 숫자도 아니면(영문·기호) 받침 없음으로 본다 — 프론트
     * {@code lib/text/korean.ts} 의 "판정 불가는 받침 없음" 과 같은 선택이다.
     */
    private static Ending endingOf(String name) {
        String trimmed = name.strip();
        if (trimmed.isEmpty()) {
            return Ending.NONE;
        }

        char last = trimmed.charAt(trimmed.length() - 1);
        if (last >= HANGUL_BASE && last <= HANGUL_LAST) {
            int jongseong = (last - HANGUL_BASE) % JONGSEONG_COUNT;
            if (jongseong == 0) {
                return Ending.NONE;
            }
            return jongseong == JONGSEONG_RIEUL ? Ending.RIEUL : Ending.OTHER;
        }
        if (last >= '0' && last <= '9') {
            return digitEnding(last);
        }
        return Ending.NONE;
    }

    /** 영(ㅇ)·일(ㄹ)·이·삼(ㅁ)·사·오·육(ㄱ)·칠(ㄹ)·팔(ㄹ)·구 */
    private static Ending digitEnding(char digit) {
        return switch (digit) {
            case '1', '7', '8' -> Ending.RIEUL;
            case '0', '3', '6' -> Ending.OTHER;
            default -> Ending.NONE;
        };
    }

    private static boolean isHangulSyllable(char c) {
        return c >= HANGUL_BASE && c <= HANGUL_LAST;
    }
}
