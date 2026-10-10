package com.hondigagae.domainlayer.auth.application.port.out;

import java.time.Duration;
import java.util.Optional;

/**
 * 비밀번호 재설정 코드/쿨다운/검증 실패 카운터 저장소.
 * 회원가입 인증({@link EmailVerificationStorePort})과 키를 분리한다 —
 * 공유하면 재설정 코드로 회원가입이 통과하거나 그 반대가 된다.
 */
public interface PasswordResetStorePort {

    void saveCode(String email, String code, Duration ttl);

    Optional<String> findCode(String email);

    void deleteCode(String email);

    /**
     * 재발송 쿨다운을 원자적으로 획득한다.
     *
     * @return 쿨다운을 새로 획득했으면 true, 이미 쿨다운 중이면 false
     */
    boolean tryAcquireCooldown(String email, Duration ttl);

    /** 코드 검증 실패 횟수를 1 올리고 누적값을 돌려준다 (브루트포스 방어). */
    long increaseVerifyFailureCount(String email, Duration ttl);

    void clearVerifyFailures(String email);

    /**
     * 재발송 쿨다운의 남은 시간 ({@code Retry-After} 용, #1293). 키가 없거나 만료가 없거나 저장소를 읽지 못하면
     * 비어 있다 — 호출부가 설정값으로 대체한다. 예외를 던지지 않는다.
     */
    Optional<Duration> findCooldownRemaining(String email);
}
