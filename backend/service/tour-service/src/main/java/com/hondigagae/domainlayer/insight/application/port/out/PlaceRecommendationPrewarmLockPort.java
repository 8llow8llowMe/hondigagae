package com.hondigagae.domainlayer.insight.application.port.out;

import java.time.Duration;

/**
 * 장소 추천 예열 작업 잠금 계약 (#1388). <b>여러 인스턴스가 같은 회차에 예열을 한 번만 돌게 한다.</b>
 *
 * <p>격자 단위 중복 호출은 {@link ForecastRefreshLockPort} 가 이미 막는다. 이 잠금은 그 위의 작업 단위다 — 인스턴스마다
 * 후보 조회 · 혼잡도 조회 · 점수 계산을 되풀이하지 않게 한다.
 *
 * <p>{@link ForecastRefreshLockPort} 와 같이 <b>절약 장치이지 정확성 장치가 아니다.</b> 놓치면 예열이 한 번 더 돌 뿐이다.
 * 그래서 Redis 장애는 "못 잡음" 으로 다룬다 — 결과 캐시와 격자 캐시도 같은 Redis 라 그때 예열은 의미가 없다.
 */
public interface PlaceRecommendationPrewarmLockPort {

    /**
     * 잠금을 시도한다. 해제하지 않고 TTL 이 풀게 둔다 — 인스턴스마다 cron 이 몇 초씩 어긋나 울려도, 먼저 끝낸 쪽이 풀어 버리면
     * 늦게 울린 쪽이 같은 회차를 또 돈다.
     *
     * @return 잡았으면 true, 이미 누가 잡았거나 Redis 를 쓸 수 없으면 false
     */
    boolean tryAcquire(Duration ttl);
}
