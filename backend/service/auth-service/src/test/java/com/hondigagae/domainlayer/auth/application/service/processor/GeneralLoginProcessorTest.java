package com.hondigagae.domainlayer.auth.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

import com.hondigagae.domainlayer.auth.application.command.AuthGeneralLoginCommand;
import com.hondigagae.domainlayer.auth.application.exception.AuthErrorCode;
import com.hondigagae.domainlayer.auth.application.exception.AuthException;
import com.hondigagae.domainlayer.auth.application.port.out.LoginAttemptStorePort;
import com.hondigagae.domainlayer.member.application.port.out.MemberRepositoryPort;
import com.hondigagae.domainlayer.member.domain.enums.MemberStatus;
import com.hondigagae.domainlayer.member.domain.model.Member;
import com.hondigagae.global.properties.LoginAttemptProperties;
import com.hondigagae.security.common.enums.SecurityRole;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * 로그인 잠금(AUTH_015)에 싣는 {@code Retry-After} 값을 고정한다 (#1293).
 *
 * <p>잠금은 이메일 키로만 동작하므로 남은 시간도 가입 여부와 무관해야 한다 — 기가입 이메일만 남은 시간이
 * 정확하고 미존재 이메일은 설정값이 나온다면, 그 차이가 곧 "이 이메일은 가입돼 있다"는 신호가 된다.
 */
class GeneralLoginProcessorTest {

    private static final String MEMBER_EMAIL = "member@example.com";
    private static final String UNKNOWN_EMAIL = "unknown@example.com";
    private static final int MAX_FAILURE_COUNT = 3;
    private static final Duration LOCK_DURATION = Duration.ofMinutes(10);

    private StubLoginAttemptStorePort loginAttemptStorePort;
    private GeneralLoginProcessor processor;

    @BeforeEach
    void setUp() {
        PasswordEncoder passwordEncoder = new BCryptPasswordEncoder(4);
        StubMemberRepositoryPort memberRepositoryPort = new StubMemberRepositoryPort();
        memberRepositoryPort.register(Member.builder()
            .id(1L).email(MEMBER_EMAIL).password(passwordEncoder.encode("P@ssw0rd!"))
            .nickname("tester").role(SecurityRole.USER).status(MemberStatus.ACTIVE)
            .build());
        loginAttemptStorePort = new StubLoginAttemptStorePort();
        processor = new GeneralLoginProcessor(
            memberRepositoryPort, passwordEncoder, loginAttemptStorePort, new LoginAttemptProperties(MAX_FAILURE_COUNT, LOCK_DURATION));
    }

    @Test
    @DisplayName("잠긴 이메일은 잠금 키의 남은 TTL 을 Retry-After 로 싣는다")
    void lockedEmailCarriesRemainingLockTtl() {
        loginAttemptStorePort.lock(MEMBER_EMAIL, LOCK_DURATION);
        loginAttemptStorePort.lockRemaining = Optional.of(Duration.ofSeconds(321));

        AuthException exception = loginAndCatch(MEMBER_EMAIL);

        assertThat(exception.getErrorCode()).isEqualTo(AuthErrorCode.LOGIN_ATTEMPT_LOCKED);
        assertThat(exception.getRetryAfter()).contains(Duration.ofSeconds(321));
    }

    @Test
    @DisplayName("남은 TTL 을 읽지 못하면 설정된 잠금 시간으로 대체한다")
    void unreadableLockTtlFallsBackToLockDuration() {
        loginAttemptStorePort.lock(MEMBER_EMAIL, LOCK_DURATION);

        AuthException exception = loginAndCatch(MEMBER_EMAIL);

        assertThat(exception.getRetryAfter()).contains(LOCK_DURATION);
    }

    @Test
    @DisplayName("임계값에 도달해 방금 잠긴 응답은 잠금 시간 전체를 싣는다")
    void freshlyLockedCarriesFullLockDuration() {
        for (int attempt = 1; attempt < MAX_FAILURE_COUNT; attempt++) {
            assertThat(loginAndCatch(MEMBER_EMAIL, "wrong").getErrorCode()).isEqualTo(AuthErrorCode.LOGIN_FAILED);
        }

        AuthException exception = loginAndCatch(MEMBER_EMAIL, "wrong");

        assertThat(exception.getErrorCode()).isEqualTo(AuthErrorCode.LOGIN_ATTEMPT_LOCKED);
        assertThat(exception.getRetryAfter()).contains(LOCK_DURATION);
    }

    @Test
    @DisplayName("미존재 이메일과 기가입 이메일의 잠금 응답은 코드 · 대기 시간이 같다")
    void lockResponseIsIdenticalRegardlessOfRegistration() {
        for (int attempt = 0; attempt < MAX_FAILURE_COUNT; attempt++) {
            loginAndCatch(MEMBER_EMAIL, "wrong");
            loginAndCatch(UNKNOWN_EMAIL, "wrong");
        }

        AuthException member = loginAndCatch(MEMBER_EMAIL);
        AuthException unknown = loginAndCatch(UNKNOWN_EMAIL);

        assertThat(member.getErrorCode()).isEqualTo(AuthErrorCode.LOGIN_ATTEMPT_LOCKED);
        assertThat(unknown.getErrorCode()).isEqualTo(member.getErrorCode());
        assertThat(unknown.getMessage()).isEqualTo(member.getMessage());
        assertThat(unknown.getRetryAfter()).isEqualTo(member.getRetryAfter());
    }

    private AuthException loginAndCatch(String email) {
        return loginAndCatch(email, "P@ssw0rd!");
    }

    private AuthException loginAndCatch(String email, String password) {
        Throwable thrown = catchThrowable(
            () -> processor.generalLogin(AuthGeneralLoginCommand.builder().email(email).password(password).build()));
        assertThat(thrown).isInstanceOf(AuthException.class);
        return (AuthException) thrown;
    }

    /** 이메일 키만 보는 저장소 — 실제 어댑터처럼 계정 존재 여부를 모른다. */
    private static class StubLoginAttemptStorePort implements LoginAttemptStorePort {

        private final Map<String, Long> failures = new HashMap<>();
        private final Set<String> locks = new HashSet<>();
        private Optional<Duration> lockRemaining = Optional.empty();

        @Override
        public boolean isLocked(String email) {
            return locks.contains(email);
        }

        @Override
        public long increaseFailureCount(String email, Duration ttl) {
            return failures.merge(email, 1L, Long::sum);
        }

        @Override
        public void lock(String email, Duration lockDuration) {
            locks.add(email);
            failures.remove(email);
        }

        @Override
        public void clearFailures(String email) {
            failures.remove(email);
            locks.remove(email);
        }

        @Override
        public Optional<Duration> findLockRemaining(String email) {
            return lockRemaining;
        }
    }

    private static class StubMemberRepositoryPort implements MemberRepositoryPort {

        private final Map<String, Member> members = new HashMap<>();

        void register(Member member) {
            members.put(member.email(), member);
        }

        @Override
        public Member save(Member domain) {
            return domain;
        }

        @Override
        public Optional<Member> findByEmail(String email) {
            return Optional.ofNullable(members.get(email));
        }

        @Override
        public boolean existsByEmailIn(List<String> emails) {
            return emails.stream().anyMatch(members::containsKey);
        }

        @Override
        public Optional<Member> findById(long memberId) {
            return Optional.empty();
        }

        @Override
        public List<String> findAllProfileImageKeys() {
            return List.of();
        }

        @Override
        public List<Long> findWithdrawnMemberIdsBefore(LocalDateTime threshold, int limit) {
            return List.of();
        }

        @Override
        public void deleteAllByIdIn(List<Long> memberIds) {
        }
    }
}
