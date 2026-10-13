package com.hondigagae.domainlayer.planner.application.model;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 요청 문구의 낱말이 바로 뒤에서 부정되는가 (#1423). 지역({@link RequestedRegion})과 실내 · 카페
 * ({@link RequestNoteConstraints})가 같은 판정을 쓴다 — 둘이 갈리면 "카페 말고 성산 위주로" 의 성산은 읽고 카페는
 * 그대로 넣는다.
 *
 * <ul>
 *   <li><b>낱말 바로 뒤 {@link #WINDOW} 자만 본다.</b> 문장부호 · 줄바꿈 · 해요체 문장 끝과 다음 낱말에서 끊는다 — "애월, 서귀포 말고"
 *       의 애월, "애월 서귀포 말고" 의 애월은 부정이 아니다</li>
 *   <li><b>부정 낱말은 {@code 말고 · 빼고 · 제외 · 싫 · 별로 · 아닌 · 아니라 · 아니고}</b> 다. 맨몸 {@code 아니} 는 쓰지 않는다
 *       — "성산 위주로 부탁해요 아니면 서귀포도 괜찮아요" 의 {@code 아니면} 이 성산을 버렸다</li>
 * </ul>
 *
 * <p><b>넓게 잡는 쪽이 늘 안전하지는 않다.</b> 낱말이 하나면 부정을 잘못 읽어도 좁히지 않을 뿐(지금과 같은 동작)이지만,
 * 낱말이 여럿이면 잘못 버린 낱말 대신 남은 낱말 쪽으로 좁혀진다. 반대로 부정을 놓치면 싫다는 지역으로 후보를 모으고 싫다는
 * 카페를 날마다 넣는다. 그래서 창은 넓게(20자) 두되 부정 낱말은 뜻이 분명한 것만 둔다.
 */
public final class RequestNoteNegation {

    /** 부정 낱말을 찾는 범위. "애월은 사람 많아서 싫어요" 의 "은 사람 많아서 싫" 이 10자다 — 8자로는 놓쳤다. */
    static final int WINDOW = 20;

    private static final Pattern NEGATION = Pattern.compile("말고|빼고|제외|싫|별로|아닌|아니라|아니고");

    /**
     * 부정을 찾다 멈추는 자리 — 쉼표 · 마침표 · 느낌표 · 물음표 · 줄바꿈, 그리고 <b>"요" 뒤의 공백</b>. 메모는 마침표 없이
     * 문장을 잇는 일이 흔해서 "실내 위주로 해주세요 더위 싫어해서" 의 {@code 싫} 이 앞 문장의 실내를 지웠다. 해요체 문장 끝을
     * 절의 끝으로 본다. "다" 뒤는 끊지 않는다 — "애월 바다 싫어요" 의 바다가 문장 끝이 아니다.
     */
    private static final Pattern CLAUSE_BREAK = Pattern.compile("[,.!?\\r\\n]|(?<=요)\\s");

    private RequestNoteNegation() {
    }

    /**
     * {@code end} 에서 끝난 낱말이 바로 뒤에서 부정되는가.
     *
     * @param requestNote 요청 문구
     * @param end         낱말이 끝난 자리(배타)
     * @param nextStart   다음 낱말이 시작하는 자리. 없으면 문구 길이 — 부정은 그 앞까지만 본다
     */
    public static boolean negatedAfter(String requestNote, int end, int nextStart) {
        int limit = Math.min(Math.min(requestNote.length(), end + WINDOW), nextStart);
        String window = requestNote.substring(end, Math.max(end, limit));
        Matcher clauseBreak = CLAUSE_BREAK.matcher(window);
        if (clauseBreak.find()) {
            window = window.substring(0, clauseBreak.start());
        }
        return NEGATION.matcher(window).find();
    }
}
