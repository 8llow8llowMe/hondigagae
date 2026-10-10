package com.hondigagae.domainlayer.auth.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.hondigagae.domainlayer.auth.application.command.AuthGeneralLoginCommand;
import com.hondigagae.domainlayer.auth.application.exception.AuthErrorCode;
import com.hondigagae.domainlayer.auth.application.exception.AuthException;
import com.hondigagae.domainlayer.auth.application.port.out.LoginAttemptStorePort;
import com.hondigagae.domainlayer.member.application.port.out.MemberRepositoryPort;
import com.hondigagae.global.properties.LoginAttemptProperties;
import java.time.Duration;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/**
 * 로그인 잠금(AUTH_015)이 {@code Retry-After} 를 싣는지 고정한다 (#1293).
 * 값은 잠금 키의 남은 TTL, 읽지 못하면 잠금 기간이다.
 */
class GeneralLoginProcessorTest {

    private static final String EMAIL = "locked@example.com";
    private static final int MAX_FAILURES = 3;
    private static final Duration LOCK_DURATION = Duration.ofMinutes(10);

    private StubLoginAttemptStorePort loginAttemptStorePort;
    private GeneralLoginProcessor processor;

    @BeforeEach
    void setUp() {
        MemberRepositoryPort memberRepositoryPort = mock(MemberRepositoryPort.class);
        when(memberRepositoryPort.findByEmail(anyString())).thenReturn(Optional.empty());
        loginAttemptStorePort = new StubLoginAttemptStorePort();
        processor = new GeneralLoginProcessor(memberRepositoryPort, new BCryptPasswordEncoder(4), loginAttemptStorePort,
            new LoginAttemptProperties(MAX_FAILURES, LOCK_DURATION));
    }

    @Test
    @DisplayName("잠긴 이메일의 429 는 잠금 키의 남은 TTL 을 초 올림해 싣는다")
    void lockedEmailCarriesRemainingLockTtl() {
        loginAttemptStorePort.locked.add(EMAIL);
        loginAttemptStorePort.lockRemaining = Optional.of(Duration.ofMillis(540_500));

        assertThatThrownBy(() -> processor.generalLogin(command()))
            .isInstanceOfSatisfying(AuthException.class, exception -> {
                assertThat(exception.getErrorCode()).isEqualTo(AuthErrorCode.LOGIN_ATTEMPT_LOCKED);
                assertThat(exception.getRetryAfterSeconds()).hasValue(541L);
            });
    }

    @Test
    @DisplayName("잠금 TTL 을 읽지 못하면 잠금 기간으로 대신한다")
    void lockedEmailFallsBackToLockDuration() {
        loginAttemptStorePort.locked.add(EMAIL);

        assertThatThrownBy(() -> processor.generalLogin(command()))
            .isInstanceOfSatisfying(AuthException.class,
                exception -> assertThat(exception.getRetryAfterSeconds()).hasValue(LOCK_DURATION.toSeconds()));
    }

    @Test
    @DisplayName("임계값에 도달해 방금 잠긴 응답도 잠금 기간을 싣고, 그 전 실패(AUTH_006)는 싣지 않는다")
    void freshLockCarriesLockDurationButPlainFailureDoesNot() {
        for (int attempt = 1; attempt < MAX_FAILURES; attempt++) {
            assertThatThrownBy(() -> processor.generalLogin(command()))
                .isInstanceOfSatisfying(AuthException.class, exception -> {
                    assertThat(exception.getErrorCode()).isEqualTo(AuthErrorCode.LOGIN_FAILED);
                    assertThat(exception.getRetryAfterSeconds()).isEmpty();
                });
        }

        assertThatThrownBy(() -> processor.generalLogin(command()))
            .isInstanceOfSatisfying(AuthException.class, exception -> {
                assertThat(exception.getErrorCode()).isEqualTo(AuthErrorCode.LOGIN_ATTEMPT_LOCKED);
                assertThat(exception.getRetryAfterSeconds()).hasValue(LOCK_DURATION.toSeconds());
            });
    }

    private AuthGeneralLoginCommand command() {
        return AuthGeneralLoginCommand.builder().email(EMAIL).password("WrongPassword1!").build();
    }

    private static class StubLoginAttemptStorePort implements LoginAttemptStorePort {

        private final Set<String> locked = new HashSet<>();
        private final Map<String, Long> failures = new HashMap<>();
        private Optional<Duration> lockRemaining = Optional.empty();

        @Override
        public boolean isLocked(String email) {
            return locked.contains(email);
        }

        @Override
        public long increaseFailureCount(String email, Duration ttl) {
            return failures.merge(email, 1L, Long::sum);
        }

        @Override
        public void lock(String email, Duration lockDuration) {
            locked.add(email);
            failures.remove(email);
        }

        @Override
        public Optional<Duration> findLockRemaining(String email) {
            return lockRemaining;
        }

        @Override
        public void clearFailures(String email) {
            failures.remove(email);
            locked.remove(email);
        }
    }
}
