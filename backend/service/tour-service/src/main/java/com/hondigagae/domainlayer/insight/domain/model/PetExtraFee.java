package com.hondigagae.domainlayer.insight.domain.model;

import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * 반려견 동반 추가 요금 원문의 <b>뜻</b>.
 *
 * <p>원천(문화정보원)은 요금 없음을 빈 값이 아니라 "없음" 이라는 낱말로 적어 보낸다. 값의 존재만 보면
 * "없음" 이 요금 있음으로 판정되어 적합도가 깎이고 "추가 요금이 있습니다 (없음)" 이라는 자기모순 문장이
 * 나간다 (#231). 그래서 판정은 문자열이 비었는지가 아니라 이 값이 무엇을 말하는지로 한다.
 *
 * <p><b>배치에서 정규화하지 않고 판정 단계에서 해석한다.</b> 원문은 장소 상세에 그대로 보여 주는 값이라
 * 저장 시 바꾸면 사용자가 보는 문구가 원천과 어긋나고, 해석 규칙이 바뀔 때마다 재적재해야 한다.
 * 해석은 그 결과를 쓰는 곳(적합도 판정)이 가진다.
 *
 * <p>판정은 보수적이다 — <b>요금이 있다고 확실히 읽히는 경우만</b> {@link Kind#CHARGED}. 0 이 아닌 숫자가
 * 있거나("20,000원", "1만원") 유료를 뜻하는 낱말이 있을 때다. 부정 표현("없음", "무료", "0원")은
 * {@link Kind#NONE}, 그 밖("별도 문의" 같은 것)은 {@link Kind#UNKNOWN} 이며 둘 다 감점하지 않는다 —
 * 모르는 것을 나쁘다고 말하지 않는 것이 이 서비스의 규칙이다.
 */
public record PetExtraFee(String raw, Kind kind) {

    public enum Kind { CHARGED, NONE, UNKNOWN }

    private static final Pattern NON_ZERO_DIGIT = Pattern.compile("[1-9]");
    /** 0, 00, 0원 처럼 숫자는 있지만 0 만 있는 표현. 요금 없음이다. */
    private static final Pattern ZERO_AMOUNT = Pattern.compile("^0+원?$");
    /** 문자·숫자만 남긴다 — "없 음", "없음.", "(없음)" 이 전부 "없음" 으로 모인다. */
    private static final Pattern NOT_LETTER_OR_DIGIT = Pattern.compile("[^\\p{L}\\p{N}]+");

    private static final List<String> NEGATIONS = List.of(
        "없음", "없다", "없습니다", "무료", "해당없음", "해당사항없음", "무", "x", "n", "no", "free", "none");
    private static final List<String> NEGATION_PHRASES = List.of("없음", "없습니다", "무료");
    private static final List<String> AFFIRMATION_PHRASES = List.of("유료", "있음", "있습니다", "부과", "받습니다");

    public static PetExtraFee of(String raw) {
        if (raw == null || raw.isBlank()) {
            return new PetExtraFee(raw, Kind.UNKNOWN);
        }
        String compact = NOT_LETTER_OR_DIGIT.matcher(raw.strip().toLowerCase(Locale.ROOT)).replaceAll("");
        if (compact.isEmpty() || ZERO_AMOUNT.matcher(compact).matches() || NEGATIONS.contains(compact)) {
            return new PetExtraFee(raw, Kind.NONE);
        }
        // 금액이 적혀 있으면 요금이다 — "무료(소형견), 대형견 5,000원" 처럼 부정 낱말이 섞여도 요금은 있다.
        if (NON_ZERO_DIGIT.matcher(compact).find() || containsAny(compact, AFFIRMATION_PHRASES)) {
            return new PetExtraFee(raw, Kind.CHARGED);
        }
        if (containsAny(compact, NEGATION_PHRASES)) {
            return new PetExtraFee(raw, Kind.NONE);
        }
        return new PetExtraFee(raw, Kind.UNKNOWN);
    }

    /** 감점과 근거 문장을 만들어도 되는 경우 — 요금이 있다고 확실히 읽힐 때만. */
    public boolean isCharged() {
        return kind == Kind.CHARGED;
    }

    private static boolean containsAny(String compact, List<String> phrases) {
        return phrases.stream().anyMatch(compact::contains);
    }
}
