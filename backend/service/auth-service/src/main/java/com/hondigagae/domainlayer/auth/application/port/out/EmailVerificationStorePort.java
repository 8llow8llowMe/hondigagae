package com.hondigagae.domainlayer.auth.application.port.out;

import java.time.Duration;
import java.util.Optional;

public interface EmailVerificationStorePort {

    void saveCode(String email, String code, Duration ttl);

    Optional<String> findCode(String email);

    void deleteCode(String email);

    void saveVerified(String email, Duration ttl);

    boolean isVerified(String email);

    void deleteVerified(String email);

    /**
     * 재발송 쿨다운을 원자적으로 획득한다.
     *
     * @return 쿨다운을 새로 획득했으면 true, 이미 쿨다운 중이면 false
     */
    boolean tryAcquireCooldown(String email, Duration ttl);
}
