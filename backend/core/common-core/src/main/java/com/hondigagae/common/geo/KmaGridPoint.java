package com.hondigagae.common.geo;

/**
 * 기상청 단기예보 격자 좌표(nx, ny).
 *
 * <p>기상청 API 는 위경도를 받지 않고 5km 격자 번호만 받는다. 캐시 키를 장소가 아니라
 * 이 격자로 잡는 것이 쿼터 방어의 핵심이다 — 장소 315곳이 서로 다른 좌표를 가져도 같은 격자에
 * 모이면 호출은 한 번이고, 한 번의 호출이 그 격자의 3일치 예보를 통째로 준다.
 *
 * <p>제주를 격자 하나로 뭉뚱그릴 수는 없다. 제주시(53,38)와 성산일출봉(60,37)은 다른 격자다.
 */
public record KmaGridPoint(int nx, int ny) {

    /** 캐시 키 조각. {@code "53:38"} 형태다. */
    public String cacheKey() {
        return nx + ":" + ny;
    }
}
