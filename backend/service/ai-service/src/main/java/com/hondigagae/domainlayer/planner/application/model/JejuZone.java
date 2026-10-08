package com.hondigagae.domainlayer.planner.application.model;

import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 한라산을 가운데 둔 제주 6권역. 프롬프트 후보 줄에 싣는 지리 신호다 (#1171).
 *
 * <p>전에는 후보 줄에 주소 문자열만 있었고, 규칙 12가 "후보 사이 이동 거리는 입력에 없다" 고 말했다 — 모델이
 * 지리를 고려할 신호가 없었다. dev 실측에서 숙소는 구좌(동쪽)인데 일정은 중문 · 애월 · 한경(서 · 남쪽)이었고
 * 직선 33~62km 구간이 여섯이었다. 주소의 읍면 이름으로 동서를 가늠하라고 맡기기보다 <b>같은 이름의 권역</b>을
 * 붙여 주면 "하루는 한 권역" 이라는 지시가 문자열 비교로 끝난다.
 *
 * <p><b>거리가 아니라 구역이다.</b> 두 권역이 맞닿아 있어도 끝과 끝은 멀 수 있다. 그래서 규칙 12(이동 거리는
 * 입력에 없다)와 어긋나지 않고, 실제 거리를 보는 일은 어댑터의 {@code AiPlanRouteGuard} 가 한다.
 *
 * <p>권역은 줄(북 · 남) 둘과 칸(서 · 가운데 · 동) 셋을 곱한 것이다. 섬이 동서로 길고 한라산이 가운데 솟아
 * 있어서, 해안도로를 따라 도는 이동은 같은 줄의 옆 칸이나 서쪽 · 동쪽 끝의 위아래로만 짧다.
 *
 * <p><b>application 모델이다</b> (#1236). 처음에는 프롬프트 어댑터 안에 있었는데, 후보 풀에 숙박을 권역마다 싣는
 * 일({@code CandidateZonePolicy}, 숙박 · 음식점)도 같은 구역 정의를 써야 해서 옮겼다 — 두 곳의 권역이 갈리면 "그 권역에 숙소가
 * 있다" 는 풀과 "그 권역에서 숙소를 고르라" 는 프롬프트가 서로 다른 지도를 본다.
 */
@Getter
@RequiredArgsConstructor
public enum JejuZone {

    NORTH_WEST("북서부"),
    NORTH("북부"),
    NORTH_EAST("북동부"),
    SOUTH_WEST("남서부"),
    SOUTH("남부"),
    SOUTH_EAST("남동부");

    /*
      제주 본섬과 가까운 섬(우도 · 가파도 · 마라도)을 감싸는 범위. 이 밖이면 제주 좌표가 아니거나 좌표가 틀린
      것이라 권역을 지어 붙이지 않는다. 추자도(위도 33.9대)는 본섬 권역 어디에도 속하지 않아 일부러 뺐다.
    */
    private static final double MIN_LAT = 33.10d;
    private static final double MAX_LAT = 33.60d;
    private static final double MIN_LNG = 126.10d;
    private static final double MAX_LNG = 127.00d;

    /** 한라산 정상(백록담)의 위도. 이보다 남쪽이면 산남(서귀포 쪽) 줄이다. */
    private static final double HALLASAN_LAT = 33.36d;

    /**
     * 서쪽 칸의 동쪽 끝 경도. 애월 · 한림 · 한경과 중문 · 안덕 · 대정이 이보다 서쪽이다 — 중문색달해수욕장
     * (126.41)까지 서쪽에 들어가고, 제주 시내 · 서귀포 시내는 가운데에 남는다.
     */
    private static final double WEST_MAX_LNG = 126.42d;

    /** 동쪽 칸의 서쪽 끝 경도. 구좌 · 성산과 표선 · 남원이 이보다 동쪽이다 — 조천 · 서귀포 시내는 가운데다. */
    private static final double EAST_MIN_LNG = 126.68d;

    private final String displayName;

    /**
     * 좌표의 권역. 좌표가 없거나 제주 범위 밖이면 null 이다 — 모르는 권역을 가장 가까운 권역으로 접지 않는다.
     */
    public static JejuZone of(Double lat, Double lng) {
        if (lat == null || lng == null || lat < MIN_LAT || lat > MAX_LAT || lng < MIN_LNG || lng > MAX_LNG) {
            return null;
        }
        boolean south = lat < HALLASAN_LAT;
        if (lng < WEST_MAX_LNG) {
            return south ? SOUTH_WEST : NORTH_WEST;
        }
        if (lng > EAST_MIN_LNG) {
            return south ? SOUTH_EAST : NORTH_EAST;
        }
        return south ? SOUTH : NORTH;
    }

    /**
     * 맞닿은 권역인가. 같은 권역도 맞닿은 것으로 본다.
     *
     * <p>같은 줄의 옆 칸과, 서쪽 해안(북서부-남서부) · 동쪽 해안(북동부-남동부)만 맞닿는다. <b>북부-남부는 맞닿지
     * 않는다</b> — 제주 시내와 서귀포 시내 사이는 한라산을 넘는 길이라 해안 쪽 이웃보다 멀고 고되다. 이 정의는
     * 시스템 프롬프트 규칙 2의 문장과 같아야 한다.
     */
    public boolean adjacentTo(JejuZone other) {
        if (other == null) {
            return false;
        }
        if (this == other) {
            return true;
        }
        return switch (this) {
            case NORTH_WEST -> other == NORTH || other == SOUTH_WEST;
            case NORTH -> other == NORTH_WEST || other == NORTH_EAST;
            case NORTH_EAST -> other == NORTH || other == SOUTH_EAST;
            case SOUTH_WEST -> other == SOUTH || other == NORTH_WEST;
            case SOUTH -> other == SOUTH_WEST || other == SOUTH_EAST;
            case SOUTH_EAST -> other == SOUTH || other == NORTH_EAST;
        };
    }

    /**
     * 섬을 한 바퀴 도는 순서 — 서쪽 해안을 내려가 남쪽을 지나 동쪽 해안을 올라온다. 이웃한 둘은 언제나
     * {@link #adjacentTo} 다(북부 → 북서부로 닫힌다). 한라산을 넘는 북부-남부는 없다.
     */
    private static final List<JejuZone> AROUND_THE_ISLAND =
        List.of(NORTH_WEST, SOUTH_WEST, SOUTH, SOUTH_EAST, NORTH_EAST, NORTH);

    /**
     * 일자별 권역 순서 제안 (#1257). {@code days} 일이면 한 바퀴 순서를 앞에서부터 하루씩 쓰고, 여섯 날을 넘으면
     * 다시 북서부부터 돈다. 프롬프트 규칙 2의 "여러 날이면 섬을 한 방향으로 돈다" 를 모델이 잘 지키지 않아서 —
     * 7일 일정이 남동부 → 남서부 56.9km 를 건넜다 — 서버가 순서를 먼저 정해 준다.
     */
    public static List<JejuZone> aroundTheIsland(int days) {
        if (days <= 0) {
            return List.of();
        }
        List<JejuZone> order = new ArrayList<>(days);
        for (int day = 0; day < days; day++) {
            order.add(AROUND_THE_ISLAND.get(day % AROUND_THE_ISLAND.size()));
        }
        return List.copyOf(order);
    }
}
