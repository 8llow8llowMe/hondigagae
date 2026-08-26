package com.hondigagae.domainlayer.emergency.domain.model;

/**
 * 두 좌표 사이의 대권 거리.
 *
 * <p>DB 사각 범위로 1차 필터한 결과를 정확한 원형 반경으로 다듬고 가까운 순 정렬에 쓴다.
 */
public final class GeoDistance {

    private static final double EARTH_RADIUS_M = 6_371_000d;

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
}
