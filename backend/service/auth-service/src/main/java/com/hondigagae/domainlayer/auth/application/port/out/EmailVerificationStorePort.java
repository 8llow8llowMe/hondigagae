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

    /**
     * 코드 오입력 횟수를 1 올리고 누적값을 돌려준다. 카운터 수명은 코드 TTL 과 같다.
     */
    long increaseVerifyFailureCount(String email, Duration ttl);

    void clearVerifyFailures(String email);

    /**
     * IP 별 발송 횟수를 1 올리고 누적값을 돌려준다. 윈도우는 첫 증가 시점부터 {@code window} 동안 유지된다.
     * 저장소 장애 시 0 을 반환한다 (fail-open — 상한은 보조 방어라 발송 자체를 막지 않는다).
     */
    long increaseIpSendCount(String clientIp, Duration window);
}
