package com.hondigagae.global.properties;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 일반 로그인 실패 횟수 제한(brute-force 방어) 설정.
 *
 * <p>기본값 5회 / 10분은 OWASP 권고 범위(3~10회, 잠금 5~30분)의 중간값이다. 오타 몇 번으로는
 * 걸리지 않고, 초당 수십 회 시도하는 스크립트는 즉시 잠긴다.
 *
 * <p>실패 카운터의 TTL 도 {@code lockDuration} 과 같은 값을 쓴다. 별도 윈도우 프로퍼티를 두면
 * 조정할 값이 늘어나기만 하고, 실패가 뜸하게 흩어진 경우 카운터가 자연 소멸해야 정상 사용자를
 * 잠그지 않는다는 요구는 이 값으로 충분히 충족된다.
 */
@ConfigurationProperties(prefix = "auth.login")
public record LoginAttemptProperties(
    int maxFailureCount,
    Duration lockDuration
) {

    public LoginAttemptProperties {
        if (maxFailureCount <= 0) {
            maxFailureCount = 5;
        }
        if (lockDuration == null || lockDuration.isZero() || lockDuration.isNegative()) {
            lockDuration = Duration.ofMinutes(10);
        }
    }
}
