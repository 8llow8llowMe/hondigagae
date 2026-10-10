package com.hondigagae.domainlayer.insight.application.port.out;

import java.time.Duration;
import java.util.Optional;

/**
 * 예보 갱신 락 계약. <b>같은 격자를 여러 인스턴스가 동시에 조회하는 것을 막는다.</b>
 *
 * <p>필요한 이유는 캐시 스탬피드다. 발표 시각이 지나 캐시가 한꺼번에 낡으면, 그 순간 들어온
 * 요청이 모두 원천으로 몰린다. 인스턴스 3대에 격자 10개면 발표 한 회차에 30건이 나갈 수 있는데,
 * 실제로 필요한 것은 10건이다. 개발계정 한도가 일 1,000건이라 이 낭비가 그대로 쿼터 소진이 된다.
 *
 * <p>이것을 포트로 꺼내 둔 것은 캐시 포트와 같은 이유다 - 성능 최적화가 아니라 <b>쿼터 정책</b>
 * 이라서, 정책 결정이 application 계층에 보여야 한다.
 *
 * <p><b>락은 정확성 장치가 아니라 절약 장치다.</b> 놓쳐도 결과는 틀리지 않고 호출이 한 번 더
 * 나갈 뿐이다. 그래서 호출부는 락을 못 잡았을 때 실패하지 않고 진행한다 - 중복 호출 한 건이
 * 사용자에게 에러를 내는 것보다 낫다.
 */
public interface ForecastRefreshLockPort {

    /**
     * 락을 시도한다. 잡으면 해제에 쓸 토큰을 준다.
     *
     * <p>토큰이 필요한 이유는 <b>남의 락을 풀지 않기 위해서다.</b> TTL 이 지나 락이 자동으로
     * 풀린 뒤 다른 요청이 같은 키를 잡았는데, 늦게 끝난 앞 요청이 키만 보고 지우면 그 요청의
     * 보호가 사라진다.
     *
     * @return 잡았으면 토큰, 이미 누가 잡고 있으면 비어 있음
     */
    Optional<String> tryAcquire(String key, Duration ttl);

    /** {@code tryAcquire} 가 준 토큰이 아직 그 키의 주인일 때만 해제한다. */
    void release(String key, String token);
}
