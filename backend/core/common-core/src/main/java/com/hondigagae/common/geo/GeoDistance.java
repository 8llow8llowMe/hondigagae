package com.hondigagae.common.geo;

/**
 * 두 좌표 사이의 대권 거리와 반경 검색용 사각 범위.
 *
 * <p>좌표 반경 검색을 쓰는 곳이 셋이라(장소 주변 검색, 동물병원 검색, 배치의 중복 판정)
 * 계산이 흩어지지 않게 한곳에 모은다. 세 곳이 같은 거리를 다르게 계산하면
 * "300m 안"의 뜻이 서로 달라진다.
 */
public final class GeoDistance {

    private static final double EARTH_RADIUS_M = 6_371_000d;
    /** 위도 1도의 대략 거리(m). 사각 범위를 잡을 때만 쓰므로 이 정도 근사면 충분하다. */
    private static final double METERS_PER_LAT_DEGREE = 111_320d;
    /** 고위도에서 cos 가 0에 가까워질 때 경도 폭이 발산하는 것을 막는 하한. */
    private static final double MIN_COS_LAT = 0.01d;

    private GeoDistance() {
    }

    public static double meters(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
            + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
            * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1d, Math.sqrt(a)));
    }

    /** 반경을 감싸는 위도 폭(도). DB 를 사각 범위로 먼저 좁히는 데 쓴다. */
    public static double latDelta(double radiusMeters) {
        return radiusMeters / METERS_PER_LAT_DEGREE;
    }

    /** 반경을 감싸는 경도 폭(도). 위도가 높을수록 넓어진다. */
    public static double lngDelta(double radiusMeters, double lat) {
        double cosLat = Math.max(Math.cos(Math.toRadians(lat)), MIN_COS_LAT);
        return radiusMeters / (METERS_PER_LAT_DEGREE * cosLat);
    }
}
