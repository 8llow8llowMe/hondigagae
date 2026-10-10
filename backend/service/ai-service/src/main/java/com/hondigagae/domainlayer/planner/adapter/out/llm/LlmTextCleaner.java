package com.hondigagae.domainlayer.planner.adapter.out.llm;

import java.util.regex.Pattern;

/**
 * 모델이 돌려준 <b>사용자에게 그대로 보이는 문장</b>(준비물 이유, 일정 근거, 항목 메모)에서
 * 프롬프트의 내부 표기를 걷어낸다.
 *
 * <p>프롬프트는 일차를 가리키는 표기를 대괄호 없이 쓰지만({@link AiPlanPromptFactory}), 그것만으로
 * 새는 것을 완전히 막지는 못한다 — 모델은 스키마 지시나 자기 습관에서 대괄호를 끌어오기도 한다
 * (#233). 프롬프트가 1차 방어, 여기가 마지막 방어다.
 *
 * <p>하는 일은 두 가지뿐이고 둘 다 뜻을 바꾸지 않는다.
 *
 * <ul>
 *   <li>대괄호를 지운다. {@code "[4일차] 흐림"} → {@code "4일차 흐림"}. 한국어 안내문에서 대괄호는
 *       쓰지 않는 표기라 짝이 맞는지 따지지 않고 문자 자체를 없앤다</li>
 *   <li>일차 범위를 접는다. {@code "1일차~3일차"} → {@code "1~3일차"}. 대괄호를 지운 뒤 남는
 *       {@code "[1일차]~[3일차]"} 의 흔적이 이 꼴이고, 그대로 두면 기계가 만든 티가 난다</li>
 * </ul>
 *
 * <p>그 밖의 문장은 손대지 않는다. 문장을 다듬는 일은 모델의 몫이고, 여기서 더 고치기 시작하면
 * 규칙이 어디까지인지 아무도 모르게 된다.
 */
final class LlmTextCleaner {

    private static final Pattern BRACKETS = Pattern.compile("[\\[\\]]");
    private static final Pattern DAY_RANGE = Pattern.compile("(\\d+)일차\\s*~\\s*(\\d+)일차");
    private static final Pattern REPEATED_SPACES = Pattern.compile(" {2,}");

    private LlmTextCleaner() {
    }

    /**
     * @param text 모델이 돌려준 문장. null 이면 null 을 그대로 돌려준다 — 없는 값을 빈 문자열로
     *             바꾸면 "이유 없음"과 "이유가 빈 문자열"이 섞인다
     */
    static String clean(String text) {
        if (text == null) {
            return null;
        }
        String cleaned = BRACKETS.matcher(text).replaceAll("");
        cleaned = DAY_RANGE.matcher(cleaned).replaceAll("$1~$2일차");
        cleaned = REPEATED_SPACES.matcher(cleaned).replaceAll(" ");
        return cleaned.strip();
    }
}
