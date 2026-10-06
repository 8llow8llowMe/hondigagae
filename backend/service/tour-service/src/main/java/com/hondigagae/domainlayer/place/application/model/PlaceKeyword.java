package com.hondigagae.domainlayer.place.application.model;

import com.hondigagae.domainlayer.place.application.exception.PlaceErrorCode;
import com.hondigagae.domainlayer.place.application.exception.PlaceException;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * 장소 키워드 검색의 정규화·LIKE 이스케이프.
 *
 * <p>컨트롤러·캐시·쿼리가 같은 규칙을 써야 "성산 " 과 "성산" 이 같은 조회가 된다.
 * 공백/빈 값은 필터 없음이고, {@code %} {@code _} {@code \} 는 리터럴로 찾는다.
 */
public final class PlaceKeyword {

    public static final int MAX_LENGTH = 50;
    public static final int MAX_TOKENS = 5;
    private static final Pattern WHITESPACE =
        Pattern.compile("\\s+", Pattern.UNICODE_CHARACTER_CLASS);

    private PlaceKeyword() {
    }

    public static Optional<String> normalize(String raw) {
        if (raw == null) {
            return Optional.empty();
        }
        String collapsed = WHITESPACE.matcher(raw).replaceAll(" ").strip();
        if (collapsed.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(collapsed);
    }

    /** 검색 경계에서 공백을 정규화하고 토큰 상한을 확인한다. */
    public static Optional<String> normalizeForSearch(String raw) {
        Optional<String> normalized = normalize(raw);
        if (normalized.isPresent() && !hasValidTokenCount(normalized.get())) {
            throw new PlaceException(PlaceErrorCode.KEYWORD_TOKEN_LIMIT_EXCEEDED);
        }
        return normalized;
    }

    public static boolean hasValidTokenCount(String raw) {
        return normalize(raw).map(value -> value.split(" ").length <= MAX_TOKENS).orElse(true);
    }

    /** 정규화된 검색어를 AND 검색에 사용할 개별 토큰으로 나눈다. */
    public static List<String> tokens(String raw) {
        return normalize(raw)
            .map(value -> List.of(value.split(" ")))
            .orElseGet(List::of);
    }

    /** LIKE 특수문자를 리터럴로 맞추기 위해 이스케이프한다. escape 문자는 {@code \\}. */
    public static String escapeLike(String keyword) {
        return keyword.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
