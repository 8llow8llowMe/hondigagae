package com.hondigagae.domainlayer.place.domain.model;

import java.util.Set;
import java.util.regex.Pattern;

/**
 * 반려동물 제한사항 원문을 <b>내보낼 값</b>으로 읽는 규칙 (#1523).
 *
 * <p>원천(문화정보원. 병합으로 관광정보 API 장소에 옮겨 온 값 포함)은 제한이 없다는 것을 빈 값이 아니라 "해당없음" ·
 * "제한사항 없음" 이라는 자리표시로 적어 보낸다(dev 실측 2026-10-16 노출 행: "제한사항 없음" 68 · "해당없음" 58, 다른 변형 0).
 * 그대로 내보내면 장소 상세에 그 낱말이 제한사항처럼 뜨고, 적합도 근거가 "일부 구역 또는 조건부로만 동반이 가능합니다.
 * (해당없음)" 같은 군더더기를 단다. 그래서 이 둘과 빈 값은 null(적힌 제한이 없다)로 읽고, 그 밖은 앞뒤 공백만 정리한
 * 원문 그대로 둔다. "목줄, 배변봉투" 같은 쉼표 목록도 쪼개지 않는다.
 *
 * <p>자리표시는 <b>공백을 모두 빼고 정확히 일치할 때만</b> 지운다 — "해당 없음" · "제한사항없음" 은 같은 뜻이지만
 * "대형견 해당없음, 소형견만 가능" 은 실제 제한이다. "없음" 같은 다른 부정 낱말도 실측에 없어 넓히지 않는다.
 * 원문을 지우는 쪽으로 틀리면 실제 제한이 화면에서 사라지고, 그 쪽이 군더더기보다 나쁘다.
 *
 * <p>insight {@code PetExtraFee} 처럼 <b>배치에서 정규화하지 않고 읽는 쪽에서 해석한다.</b> 원문은 DB 에 그대로 두어
 * 규칙이 바뀌어도 재적재하지 않는다. 장소 상세({@code PlaceQueryProcessor})와 적합도 근거 문장({@code SuitabilityEvaluator})이
 * 이 한 규칙을 같이 쓴다 — 같은 장소의 제한사항을 두 화면이 다르게 말하지 않게.
 */
public final class PetRestriction {

    /** 공백. {@code \s} 는 NBSP · 전각 공백을 놓치므로 유니코드 공백 구분자({@code \p{Z}})도 함께 본다. */
    private static final String SPACE = "[\\s\\p{Z}]";
    private static final Pattern EDGE_SPACES = Pattern.compile("^" + SPACE + "+|" + SPACE + "+$");
    private static final Pattern SPACES = Pattern.compile(SPACE + "+");

    /** "제한 없음" 을 뜻하는 원천 자리표시. 공백을 뺀 모양으로 둔다. */
    private static final Set<String> NO_RESTRICTION_PLACEHOLDERS = Set.of("해당없음", "제한사항없음");

    private PetRestriction() {
    }

    /**
     * @param raw 원천 제한사항 원문 (null 가능)
     * @return 앞뒤 공백을 정리한 제한사항 원문. 비었거나 "제한 없음" 자리표시면 null
     */
    public static String stated(String raw) {
        if (raw == null) {
            return null;
        }
        String text = EDGE_SPACES.matcher(raw).replaceAll("");
        if (text.isEmpty() || NO_RESTRICTION_PLACEHOLDERS.contains(SPACES.matcher(text).replaceAll(""))) {
            return null;
        }
        return text;
    }
}
