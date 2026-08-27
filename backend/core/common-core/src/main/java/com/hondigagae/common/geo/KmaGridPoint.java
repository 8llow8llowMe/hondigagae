package com.hondigagae.common.geo;

/**
 * 기상청 단기예보 격자 좌표(nx, ny).
 *
 * <p>기상청 API 는 위경도를 받지 않고 5km 격자 번호만 받는다. 캐시 키를 장소가 아니라
 * 이 격자로 잡는 것이 쿼터 방어의 핵심이다 — 장소 315곳이 서로 다른 좌표를 가져도 같은 격자에
 * 모이면 호출은 한 번이고, 한 번의 호출이 그 격자의 5일치 예보를 통째로 준다.
 *
 * <p>제주를 격자 하나로 뭉뚱그릴 수는 없다. 제주시(53,38)와 성산일출봉(60,37)은 다른 격자다.
 */
public record KmaGridPoint(int nx, int ny) {

    /** 캐시 키 조각. {@code "53:38"} 형태다. */
    public String cacheKey() {
        return nx + ":" + ny;
    }

    /**
     * 인접 격자를 {@code factor} 칸씩 묶어 대표 격자 하나로 접는다.
     *
     * <p><b>정확도를 내주고 쿼터를 사는 거래다.</b> 실측 기준 제주 육지를 덮는 격자가 94개이고
     * 발표가 하루 8회라 최대 752건인데, factor 2 로 묶으면 격자가 대략 1/4 로 줄어 200건 아래가
     * 된다. 대신 최대 10km 떨어진 지점의 날씨를 쓰게 된다.
     *
     * <p><b>기본값이 1(끔)인 이유는 제주의 지형 때문이다.</b> 한라산(해발 1,950m)과 해안은
     * 기온이 10도 넘게 차이 나는데, 묶으면 그 둘이 한 격자로 뭉개진다. 반려견 기준 고온 판정이
     * 이 서비스의 핵심이라 함부로 내줄 정확도가 아니다.
     *
     * <p>그래서 쿼터가 실제로 빠듯해졌을 때 켜는 지렛대로 남긴다. 켤 때는 해안 위주 장소가
     * 대부분인지 먼저 확인하는 편이 좋다.
     *
     * <p>대표 격자는 블록의 <b>좌하단</b>이다. 중앙을 쓰면 factor 가 짝수일 때 블록 밖으로
     * 나갈 수 있고, 어느 쪽이든 같은 블록의 모든 좌표가 같은 값을 얻는 것이 요점이다.
     *
     * @param factor 묶을 칸 수. 1 이하면 묶지 않고 그대로 돌려준다
     */
    public KmaGridPoint coarsenedBy(int factor) {
        if (factor <= 1) {
            return this;
        }
        return new KmaGridPoint(floorTo(nx, factor), floorTo(ny, factor));
    }

    /** 음수 좌표에서도 블록이 어긋나지 않도록 내림으로 맞춘다. */
    private static int floorTo(int value, int factor) {
        return Math.floorDiv(value, factor) * factor;
    }
}
