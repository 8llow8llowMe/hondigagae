package com.hondigagae.domainlayer.placeimport.domain.model;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 반려동물 관련 자유 텍스트를 가공 enum 문자열로 바꾼다.
 *
 * <p>제주 전량(관광 API 29건, 문화정보원 1,191건)의 실제 값 분포를 세어 규칙을 정했다.
 * 값 종류가 적어 정규식과 키워드로 충분히 잡힌다. 자세한 분포는 {@code docs/data-api-analysis.md} 참고.
 *
 * <p>반환값은 tour-service 의 {@code AllowedPetSize} / {@code PetAllowanceType} enum 이름과 맞춘다.
 * batch-service 는 tour-service 를 의존하지 않으므로 문자열로 넘기고, 값이 어긋나면 적재 시점이 아니라
 * 조회 시점에 터진다 — 그래서 상수로 고정해 오타를 막는다.
 */
public final class PetFieldParser {

    // AllowedPetSize
    public static final String SIZE_ALL = "ALL";
    public static final String SIZE_SMALL_ONLY = "SMALL_ONLY";
    public static final String SIZE_SMALL_MEDIUM = "SMALL_MEDIUM";
    public static final String SIZE_UNKNOWN = "UNKNOWN";

    // PetAllowanceType
    public static final String ALLOWANCE_ALLOWED = "ALLOWED";
    public static final String ALLOWANCE_PARTIALLY = "PARTIALLY_ALLOWED";
    public static final String ALLOWANCE_NOT_ALLOWED = "NOT_ALLOWED";
    public static final String ALLOWANCE_UNKNOWN = "UNKNOWN";

    /** "5kg 이하", "10kg이하", "훈련된 5KG 이하" 등에서 무게를 뽑는다. */
    private static final Pattern WEIGHT = Pattern.compile("(\\d+)\\s*kg", Pattern.CASE_INSENSITIVE);
    /** 소형견만 받는 곳을 가르는 기준(kg). 이 값 이하면 소형 전용으로 본다. */
    private static final int SMALL_ONLY_LIMIT = 10;

    private PetFieldParser() {
    }

    /**
     * 입장 가능 동물 크기.
     *
     * <p>문화정보원은 "모두 가능", "소형", "소형/중형", "5kg 이하" 형태로,
     * 관광 API 는 "전 견종 동반 가능", "9kg 이하 동반 가능" 형태로 들어온다.
     */
    public static String parseAllowedPetSize(String raw) {
        if (isBlank(raw)) {
            return SIZE_UNKNOWN;
        }
        String value = raw.trim();

        Matcher matcher = WEIGHT.matcher(value);
        if (matcher.find()) {
            int weight = Integer.parseInt(matcher.group(1));
            return weight <= SMALL_ONLY_LIMIT ? SIZE_SMALL_ONLY : SIZE_SMALL_MEDIUM;
        }
        if (value.contains("모두") || value.contains("전 견종") || value.contains("전견종")) {
            return SIZE_ALL;
        }
        if (value.contains("중형") || value.contains("대형")) {
            return SIZE_SMALL_MEDIUM;
        }
        if (value.contains("소형")) {
            return SIZE_SMALL_ONLY;
        }
        return SIZE_UNKNOWN;
    }

    /**
     * 동반 가능 구분.
     *
     * <p>문화정보원은 Y/N 플래그와 "전구역/일부구역" 문구가 따로 있고,
     * 관광 API 는 {@code acmpyTypeCd} 에 "전구역 동반가능" / "일부구역 동반가능" 2종만 온다.
     */
    public static String parseAllowanceType(boolean petAvailable, String scopeText) {
        if (!petAvailable) {
            return ALLOWANCE_NOT_ALLOWED;
        }
        if (isBlank(scopeText)) {
            return ALLOWANCE_ALLOWED;
        }
        String value = scopeText.trim();
        // "야외만 반려동물 동반 가능"(문화정보원), "일부구역 동반가능"(관광 API) 모두 실내 제약을 뜻한다.
        if (value.contains("일부") || value.contains("부분") || value.contains("야외만")) {
            return ALLOWANCE_PARTIALLY;
        }
        // 동반 가능 플래그가 이미 켜져 있으므로, 문구가 무엇이든 기본은 동반 가능이다.
        // "제한사항 없음", "목줄, 배변봉투" 처럼 범위와 무관한 문구가 대부분이라 UNKNOWN 으로 떨어뜨리지 않는다.
        return ALLOWANCE_ALLOWED;
    }

    /**
     * 입장 가능 체중 상한(kg). "12kg 미만", "5kg 이하" 에서 숫자를 뽑는다. 없으면 null.
     *
     * <p>enum({@code parseAllowedPetSize})은 10kg 경계로 뭉개므로 "12kg 미만" 인 곳이
     * SMALL_MEDIUM(중형까지) 이 되어 20kg 중형견도 통과해 버린다. 숫자를 따로 보존해야
     * 체중 필터가 정확해진다. 미만/이하는 구분하지 않는다 — 1kg 오차는 크기 구분(enum)의
     * 오차보다 작고, 경계 체중이면 어차피 현장 확인이 필요하다.
     */
    public static Integer parseMaxWeightKg(String raw) {
        if (isBlank(raw)) {
            return null;
        }
        Matcher matcher = WEIGHT.matcher(raw);
        if (matcher.find()) {
            return Integer.parseInt(matcher.group(1));
        }
        return null;
    }

    /** 문화정보원의 Y/N 플래그. 빈 값은 false 로 본다. */
    public static boolean parseYn(String raw) {
        return raw != null && "Y".equalsIgnoreCase(raw.trim());
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
