package com.hondigagae.domainlayer.auth.application.port.out;

import java.time.Duration;

/**
 * 로그인 실패 횟수 / 잠금 상태 저장소 계약.
 *
 * <p>모든 메서드는 <b>이메일만</b>을 키로 받는다. 계정 존재 여부를 인자로 받지 않으므로
 * 미존재 이메일과 기가입 이메일이 저장소 관점에서 구분되지 않는다 (계정 열거 방지).
 */
public interface LoginAttemptStorePort {

    /**
     * 잠금 상태 여부. 저장소 장애 시에는 fail-open 으로 {@code false} 를 반환한다
     * (근거는 구현체 {@code RedisLoginAttemptStoreAdapter} 주석 참고).
     */
    boolean isLocked(String email);

    /**
     * 실패 카운터를 1 증가시키고 누적 실패 횟수를 반환한다. 저장소 장애 시에는 0 을 반환해
     * 호출부가 임계값 판정을 건너뛰게 한다.
     */
    long increaseFailureCount(String email, Duration ttl);

    /** 잠금을 설정한다. */
    void lock(String email, Duration lockDuration);

    /** 실패 카운터와 잠금을 모두 해제한다 (로그인 성공 시). */
    void clearFailures(String email);
}
