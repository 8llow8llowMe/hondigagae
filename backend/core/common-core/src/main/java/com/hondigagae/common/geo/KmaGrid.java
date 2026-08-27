package com.hondigagae.common.geo;

/**
 * 위경도 -> 기상청 단기예보 격자(DFS) 변환.
 *
 * <p>기상청 단기예보(VilageFcstInfoService_2.0)는 위경도를 받지 않는다. 5km 격자 번호
 * {@code nx}/{@code ny} 만 받으므로 장소 좌표로 날씨를 조회하려면 반드시 이 변환을 거쳐야 한다.
 * 기상청이 공개한 Lambert Conformal Conic 투영 상수와 계산식을 그대로 옮긴 것이며,
 * 상수는 임의로 바꾸면 안 된다.
 *
 * <p>변환기를 {@code GeoDistance} 옆 common-core 에 둔 이유는 하버사인을 한곳에 모은 이유와
 * 같다. tour-service 의 실시간 조회와 batch-service 의 사전 계산이 서로 다른 격자를 내면
 * 캐시가 갈라지고 같은 장소에 다른 날씨가 붙는다.
 */
public final class KmaGrid {

    /** 지구 반경(km). 기상청 제공 상수. */
    private static final double EARTH_RADIUS_KM = 6371.00877d;
    /** 격자 간격(km). */
    private static final double GRID_KM = 5.0d;
    /** 표준 위도 1(degree). */
    private static final double PROJECTION_LAT1 = 30.0d;
    /** 표준 위도 2(degree). */
    private static final double PROJECTION_LAT2 = 60.0d;
    /** 기준점 경도(degree). */
    private static final double ORIGIN_LNG = 126.0d;
    /** 기준점 위도(degree). */
    private static final double ORIGIN_LAT = 38.0d;
    /** 기준점 X 격자. */
    private static final int ORIGIN_X = 43;
    /** 기준점 Y 격자. */
    private static final int ORIGIN_Y = 136;

    private static final double DEG_TO_RAD = Math.PI / 180.0d;
    private static final double QUARTER_PI = Math.PI * 0.25d;

    private KmaGrid() {
    }

    /**
     * 위경도를 격자 좌표로 변환한다.
     *
     * @param lat 위도(degree)
     * @param lng 경도(degree)
     */
    public static KmaGridPoint of(double lat, double lng) {
        double re = EARTH_RADIUS_KM / GRID_KM;
        double slat1 = PROJECTION_LAT1 * DEG_TO_RAD;
        double slat2 = PROJECTION_LAT2 * DEG_TO_RAD;
        double olon = ORIGIN_LNG * DEG_TO_RAD;
        double olat = ORIGIN_LAT * DEG_TO_RAD;

        double sn = Math.tan(QUARTER_PI + slat2 * 0.5d) / Math.tan(QUARTER_PI + slat1 * 0.5d);
        sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);

        double sf = Math.tan(QUARTER_PI + slat1 * 0.5d);
        sf = Math.pow(sf, sn) * Math.cos(slat1) / sn;

        double ro = Math.tan(QUARTER_PI + olat * 0.5d);
        ro = re * sf / Math.pow(ro, sn);

        double ra = Math.tan(QUARTER_PI + lat * DEG_TO_RAD * 0.5d);
        ra = re * sf / Math.pow(ra, sn);

        double theta = lng * DEG_TO_RAD - olon;
        if (theta > Math.PI) {
            theta -= 2.0d * Math.PI;
        }
        if (theta < -Math.PI) {
            theta += 2.0d * Math.PI;
        }
        theta *= sn;

        int nx = (int) Math.floor(ra * Math.sin(theta) + ORIGIN_X + 0.5d);
        int ny = (int) Math.floor(ro - ra * Math.cos(theta) + ORIGIN_Y + 0.5d);
        return new KmaGridPoint(nx, ny);
    }
}
