package com.hondigagae.domainlayer.place.application.model;

import java.util.Optional;

/**
 * 장소 키워드 검색의 정규화·LIKE 이스케이프.
 *
 * <p>컨트롤러·캐시·쿼리가 같은 규칙을 써야 "성산 " 과 "성산" 이 같은 조회가 된다.
 * 공백/빈 값은 필터 없음이고, {@code %} {@code _} {@code \} 는 리터럴로 찾는다.
 */
public final class PlaceKeyword {

    public static final int MAX_LENGTH = 50;

    private PlaceKeyword() {
    }

    public static Optional<String> normalize(String raw) {
        if (raw == null) {
            return Optional.empty();
        }
        String collapsed = raw.strip().replaceAll("\\s+", " ");
        if (collapsed.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(collapsed);
    }

    /** LIKE 특수문자를 리터럴로 맞추기 위해 이스케이프한다. escape 문자는 {@code \\}. */
    public static String escapeLike(String keyword) {
        return keyword.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
