package com.hondigagae.domainlayer.placeimport.domain.model;

/**
 * 장소 동일성 판정 유틸.
 *
 * <p>제주 실측에서 얻은 두 가지가 규칙의 근거다.
 * <ul>
 *   <li>이름이 좌표보다 믿을 만하다 — {@code 도치돌목장}과 {@code 도치돌 알파카목장}은 99m 떨어져 있지만 같은 곳이고,
 *       {@code 녹차미로공원}과 {@code 쉼한모금}은 93m 거리의 서로 다른 시설이다.</li>
 *   <li>원천마다 기준점이 다르다 — {@code 서우봉}(정상)과 {@code 서우봉둘레길}(입구)처럼 같은 이름도 좌표가 멀 수 있다.</li>
 * </ul>
 */
public final class PlaceNameMatcher {

    private static final double EARTH_RADIUS_M = 6_371_000d;

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

    /** 하버사인 거리(m). */
    public static double distanceMeters(double lat1, double lng1, double lat2, double lng2) {
        double phi1 = Math.toRadians(lat1);
        double phi2 = Math.toRadians(lat2);
        double deltaPhi = Math.toRadians(lat2 - lat1);
        double deltaLambda = Math.toRadians(lng2 - lng1);

        double a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2)
            + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
        return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1d, Math.sqrt(a)));
    }
}
