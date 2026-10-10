package com.hondigagae.domainlayer.placeimport.domain.model;

import com.hondigagae.common.geo.GeoDistance;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 장소 동일성 판정 유틸.
 *
 * <p>제주 실측에서 얻은 두 가지가 규칙의 근거다.
 * <ul>
 *   <li>이름이 좌표보다 믿을 만하다 — {@code 도치돌목장}과 {@code 도치돌 알파카목장}은 99m 떨어져 있지만 같은 곳이고
 *       ({@link #isSharedCoreMatch 공통 부분 일치}로 잡는다, #1282),
 *       {@code 녹차미로공원}과 {@code 쉼한모금}은 93m 거리의 서로 다른 시설이다.</li>
 *   <li>원천마다 기준점이 다르다 — {@code 서우봉}(정상)과 {@code 서우봉둘레길}(입구)처럼 같은 이름도 좌표가 멀 수 있다.</li>
 * </ul>
 */
public final class PlaceNameMatcher {

    /** 공통 부분 일치에서 두 이름이 함께 가져야 하는 최소 글자 수. */
    private static final int MIN_SHARED_LENGTH = 3;
    /** 공통 부분에서 일반 낱말을 걷어 낸 뒤에도 남아야 하는 글자 수. {@code 기당}·{@code 도립} 이 2자다. */
    private static final int MIN_DISTINCT_LENGTH = 2;
    /**
     * 공통 부분이 이것들로만 되어 있으면 같은 곳이라는 근거가 되지 않는다 — 지역명과 시설 유형.
     * {@code 러브랜드미술관}과 {@code 제주특별자치도립미술관}은 {@code 미술관}만 겹치는 다른 곳이다.
     * 긴 낱말을 먼저 지운다({@code 제주특별자치도} 를 {@code 제주} 보다 먼저).
     */
    private static final List<String> GENERIC_WORDS = List.of(
        "제주특별자치도", "특별자치도", "서귀포시", "제주시", "서귀포", "제주도", "제주",
        "문예회관", "해수욕장", "미술관", "박물관", "기념관", "전시관", "리조트",
        "펜션", "호텔", "콘도", "카페", "식당", "공원", "해변", "포구", "오름", "올레", "코스", "목장", "마을", "유적", "센터"
    );

    private PlaceNameMatcher() {
    }

    /**
     * 표기 차이를 걷어낸다. 괄호·대괄호 안 부연({@code 거문오름 [세계자연유산]}, {@code 관덕정(제주)})을 없애고
     * 공백·기호를 제거한 뒤 소문자로 만든다.
     */
    public static String normalize(String name) {
        if (name == null) {
            return "";
        }
        return name.replaceAll("[(\\[].*?[)\\]]", "")
            .replaceAll("[^0-9A-Za-z가-힣]", "")
            .toLowerCase();
    }

    public static boolean isExactMatch(String left, String right) {
        String a = normalize(left);
        String b = normalize(right);
        return !a.isEmpty() && a.equals(b);
    }

    /**
     * 한쪽이 다른 쪽을 품는 관계. {@code 노리매}와 {@code 노리매공원} 같은 경우를 잡는다.
     * 너무 짧은 이름은 우연히 겹치므로 2자 이하는 제외한다.
     */
    public static boolean isPartialMatch(String left, String right) {
        String a = normalize(left);
        String b = normalize(right);
        if (a.length() <= 2 || b.length() <= 2 || a.equals(b)) {
            return false;
        }
        return a.contains(b) || b.contains(a);
    }

    /**
     * 두 이름이 같은 고유한 부분을 넉넉히 함께 갖는 관계 (#1282). 한쪽이 다른 쪽을 통째로 품지 않아
     * {@link #isPartialMatch 부분일치}로는 못 잡는 {@code 도치돌목장} · {@code 도치돌 알파카목장},
     * {@code 서귀포시기당미술관} · {@code 서귀포시립기당미술관} 같은 경우다.
     *
     * <p>세 가지를 모두 만족해야 한다.
     * <ul>
     *   <li>가장 긴 공통 부분이 {@value #MIN_SHARED_LENGTH}자 이상</li>
     *   <li>그 부분이 짧은 쪽 이름의 절반 이상 — 긴 이름의 한 귀퉁이만 겹치는 것을 거른다</li>
     *   <li>그 부분에서 지역명 · 시설 유형({@link #GENERIC_WORDS})을 걷어 내도 {@value #MIN_DISTINCT_LENGTH}자 이상 남는다</li>
     * </ul>
     * 가장 긴 공통 부분이 여럿이면(같은 길이) 하나라도 조건을 만족하면 받는다 — 인자 순서와 무관하게 같은 답을 낸다.
     * 완전일치나 부분일치인 쌍은 여기서 {@code false} 다 — 더 강한 판정이 먼저 받는다.
     */
    public static boolean isSharedCoreMatch(String left, String right) {
        String a = normalize(left);
        String b = normalize(right);
        if (a.isEmpty() || b.isEmpty() || a.equals(b) || a.contains(b) || b.contains(a)) {
            return false;
        }
        int shorter = Math.min(a.length(), b.length());
        return longestCommonSubstrings(a, b).stream()
            .anyMatch(shared -> shared.length() >= MIN_SHARED_LENGTH
                && shared.length() * 2 >= shorter
                && withoutGenericWords(shared).length() >= MIN_DISTINCT_LENGTH);
    }

    /** 두 문자열이 함께 갖는 가장 긴 연속 부분 문자열 전부. 공통 글자가 없으면 빈 집합이다. */
    private static Set<String> longestCommonSubstrings(String a, String b) {
        int bestLength = 0;
        Set<String> best = new HashSet<>();
        int[] previous = new int[b.length() + 1];
        for (int i = 1; i <= a.length(); i++) {
            int[] current = new int[b.length() + 1];
            for (int j = 1; j <= b.length(); j++) {
                if (a.charAt(i - 1) != b.charAt(j - 1)) {
                    continue;
                }
                current[j] = previous[j - 1] + 1;
                if (current[j] > bestLength) {
                    bestLength = current[j];
                    best.clear();
                }
                if (current[j] == bestLength) {
                    best.add(a.substring(i - bestLength, i));
                }
            }
            previous = current;
        }
        return best;
    }

    private static String withoutGenericWords(String text) {
        String rest = text;
        for (String word : GENERIC_WORDS) {
            rest = rest.replace(word, "");
        }
        return rest;
    }

    /** 하버사인 거리(m). */
    public static double distanceMeters(double lat1, double lng1, double lat2, double lng2) {
        // 같은 계산을 세 곳(장소 검색·긴급 시설·병합 판정)이 따로 하면 "300m 안"의 뜻이
        // 갈라진다. common-core 의 한 구현에 위임한다.
        return GeoDistance.meters(lat1, lng1, lat2, lng2);
    }
}
