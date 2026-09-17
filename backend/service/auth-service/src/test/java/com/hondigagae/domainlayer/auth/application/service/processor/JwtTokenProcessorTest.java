package com.hondigagae.domainlayer.auth.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.auth.application.exception.AuthErrorCode;
import com.hondigagae.domainlayer.auth.application.exception.AuthException;
import com.hondigagae.domainlayer.auth.application.info.JwtTokenIssueInfo;
import com.hondigagae.domainlayer.auth.application.info.JwtTokenReissueInfo;
import com.hondigagae.domainlayer.auth.application.port.out.JwtTokenStorePort;
import com.hondigagae.domainlayer.member.application.port.out.MemberRepositoryPort;
import com.hondigagae.domainlayer.member.domain.enums.MemberStatus;
import com.hondigagae.domainlayer.member.domain.model.Member;
import com.hondigagae.security.auth.jwt.JwtAuthProperties;
import com.hondigagae.security.auth.jwt.JwtAuthProvider;
import com.hondigagae.security.common.enums.SecurityRole;
import java.time.Duration;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class JwtTokenProcessorTest {

    private static final long MEMBER_ID = 1L;
    private static final String ACCESS_KEY = "test-access-key-test-access-key-test-access-key-test-access-key!!";
    private static final String REFRESH_KEY = "test-refresh-key-test-refresh-key-test-refresh-key-test-refresh!!";

    private JwtAuthProvider jwtAuthProvider;
    private StubJwtTokenStorePort tokenStorePort;
    private StubMemberRepositoryPort memberRepositoryPort;
    private JwtTokenProcessor processor;

    @BeforeEach
    void setUp() {
        JwtAuthProperties properties = new JwtAuthProperties(
            ACCESS_KEY, Duration.ofMinutes(30), REFRESH_KEY, Duration.ofDays(14));
        jwtAuthProvider = new JwtAuthProvider(properties);
        tokenStorePort = new StubJwtTokenStorePort();
        memberRepositoryPort = new StubMemberRepositoryPort();
        memberRepositoryPort.register(activeMember());
        processor = new JwtTokenProcessor(jwtAuthProvider, properties, tokenStorePort, memberRepositoryPort);
    }

    @Test
    void issueTokens_twice_keepsBothDeviceSessions() {
        // 두 기기에서 각각 로그인해도 서로의 세션을 덮어쓰지 않는다
        processor.issueTokens(MEMBER_ID, SecurityRole.USER);
        processor.issueTokens(MEMBER_ID, SecurityRole.USER);

        assertThat(tokenStorePort.sessionCount(MEMBER_ID)).isEqualTo(2);
    }

    @Test
    void reissueTokens_rotatesSessionWithoutGrowingCount() {
        JwtTokenIssueInfo issued = processor.issueTokens(MEMBER_ID, SecurityRole.USER);

        JwtTokenReissueInfo reissued = processor.reissueTokens(issued.refreshToken());

        // 이전 세션 키를 지우고 새 키로 교체하므로 세션 수는 늘지 않고 토큰은 항상 바뀐다
        assertThat(tokenStorePort.sessionCount(MEMBER_ID)).isEqualTo(1);
        assertThat(reissued.newRefreshToken()).isNotEqualTo(issued.refreshToken());
    }

    @Test
    void reissueTokens_withRotatedOutToken_rejects() {
        JwtTokenIssueInfo issued = processor.issueTokens(MEMBER_ID, SecurityRole.USER);
        processor.reissueTokens(issued.refreshToken());

        // 회전 전 토큰의 세션 키는 삭제되어 재사용(탈취 재생) 시 거부된다
        assertThatThrownBy(() -> processor.reissueTokens(issued.refreshToken()))
            .isInstanceOf(AuthException.class)
            .extracting(exception -> ((AuthException) exception).getErrorCode())
            .isEqualTo(AuthErrorCode.EXPIRED_REFRESH_TOKEN);
    }

    @Test
    void reissueTokens_losingConcurrentRotation_rejectsWithoutNewSession() {
        JwtTokenIssueInfo issued = processor.issueTokens(MEMBER_ID, SecurityRole.USER);
        tokenStorePort.forceRotationLost = true;

        // 조회·비교는 통과했지만 원자 삭제에서 진 쪽 — 이미 회전된 토큰의 재사용과 같은 취급이다
        assertThatThrownBy(() -> processor.reissueTokens(issued.refreshToken()))
            .isInstanceOf(AuthException.class)
            .extracting(exception -> ((AuthException) exception).getErrorCode())
            .isEqualTo(AuthErrorCode.INVALID_REFRESH_TOKEN);
        // 진 쪽이 새 세션을 저장하면 세션이 증식한다 — 발급 시점의 1개 그대로여야 한다
        assertThat(tokenStorePort.sessionCount(MEMBER_ID)).isEqualTo(1);
    }

    @Test
    void reissueTokens_withEvictedSession_rejectsAsExpired() {
        JwtTokenIssueInfo issued = processor.issueTokens(MEMBER_ID, SecurityRole.USER);
        tokenStorePort.deleteAllSessions(MEMBER_ID);

        // 상한 초과로 밀려났거나 무효화된 세션은 재로그인 대상이다
        assertThatThrownBy(() -> processor.reissueTokens(issued.refreshToken()))
            .isInstanceOf(AuthException.class)
            .extracting(exception -> ((AuthException) exception).getErrorCode())
            .isEqualTo(AuthErrorCode.EXPIRED_REFRESH_TOKEN);
    }

    @Test
    void revokeCurrentSession_removesOnlyThatDevice() {
        JwtTokenIssueInfo deviceA = processor.issueTokens(MEMBER_ID, SecurityRole.USER);
        JwtTokenIssueInfo deviceB = processor.issueTokens(MEMBER_ID, SecurityRole.USER);

        processor.revokeCurrentSession(MEMBER_ID, "access-token-id", deviceA.refreshToken());

        // A 기기 세션만 사라지고 B 기기는 계속 재발급할 수 있다
        assertThat(tokenStorePort.sessionCount(MEMBER_ID)).isEqualTo(1);
        assertThat(processor.reissueTokens(deviceB.refreshToken())).isNotNull();
        assertThat(tokenStorePort.blacklistedTokenIds).contains("access-token-id");
    }

    @Test
    void revokeCurrentSession_withoutRefreshCookie_onlyBlacklistsAccessToken() {
        processor.issueTokens(MEMBER_ID, SecurityRole.USER);

        processor.revokeCurrentSession(MEMBER_ID, "access-token-id", null);

        // 쿠키가 없으면 세션 특정이 불가하므로 세션은 남고 access 만 무효화된다
        assertThat(tokenStorePort.sessionCount(MEMBER_ID)).isEqualTo(1);
        assertThat(tokenStorePort.blacklistedTokenIds).contains("access-token-id");
    }

    @Test
    void revokeAllSessions_removesEveryDevice() {
        processor.issueTokens(MEMBER_ID, SecurityRole.USER);
        processor.issueTokens(MEMBER_ID, SecurityRole.USER);

        processor.revokeAllSessions(MEMBER_ID, "access-token-id");

        assertThat(tokenStorePort.sessionCount(MEMBER_ID)).isZero();
        assertThat(tokenStorePort.blacklistedTokenIds).contains("access-token-id");
    }

    private Member activeMember() {
        return Member.builder()
            .id(MEMBER_ID)
            .email("member@example.com")
            .nickname("tester")
            .role(SecurityRole.USER)
            .status(MemberStatus.ACTIVE)
            .build();
    }

    private static class StubJwtTokenStorePort implements JwtTokenStorePort {

        private final Map<String, String> tokens = new HashMap<>();
        private final Set<String> blacklistedTokenIds = new HashSet<>();
        /** 동시 재발급에서 원자 삭제에 진 상황을 흉내낸다 — 다른 요청이 먼저 회전시킨 경우. */
        private boolean forceRotationLost;

        @Override
        public void save(long memberId, String sessionId, String refreshToken) {
            tokens.put(memberId + ":" + sessionId, refreshToken);
        }

        @Override
        public java.util.List<com.hondigagae.domainlayer.auth.application.port.out.query.RefreshSessionQueryResult> findSessions(long memberId) {
            return java.util.List.of();
        }

        @Override
        public Optional<String> find(long memberId, String sessionId) {
            return Optional.ofNullable(tokens.get(memberId + ":" + sessionId));
        }

        @Override
        public void deleteSession(long memberId, String sessionId) {
            tokens.remove(memberId + ":" + sessionId);
        }

        @Override
        public boolean deleteSessionIfTokenMatches(long memberId, String sessionId, String expectedToken) {
            if (forceRotationLost) {
                return false;
            }
            return tokens.remove(memberId + ":" + sessionId, expectedToken);
        }

        @Override
        public void deleteAllSessions(long memberId) {
            tokens.keySet().removeIf(key -> key.startsWith(memberId + ":"));
        }

        @Override
        public void saveAccessTokenIdBlacklist(String tokenId, Duration ttl) {
            blacklistedTokenIds.add(tokenId);
        }

        long sessionCount(long memberId) {
            return tokens.keySet().stream().filter(key -> key.startsWith(memberId + ":")).count();
        }
    }

    private static class StubMemberRepositoryPort implements MemberRepositoryPort {

        private final Map<Long, Member> members = new HashMap<>();

        void register(Member member) {
            members.put(member.id(), member);
        }

        @Override
        public Member save(Member domain) {
            members.put(domain.id(), domain);
            return domain;
        }

        @Override
        public Optional<Member> findByEmail(String email) {
            return members.values().stream().filter(member -> member.email().equals(email)).findFirst();
        }

        @Override
        public boolean existsByEmailIn(java.util.List<String> emails) {
            return emails.stream().anyMatch(email -> findByEmail(email).isPresent());
        }

        @Override
        public Optional<Member> findById(long memberId) {
            return Optional.ofNullable(members.get(memberId));
        }

        @Override
        public java.util.List<String> findAllProfileImageKeys() {
            return java.util.List.of();
        }

        @Override
        public java.util.List<Long> findWithdrawnMemberIdsBefore(java.time.LocalDateTime threshold, int limit) {
            return java.util.List.of();
        }

        @Override
        public void deleteAllByIdIn(java.util.List<Long> memberIds) {
        }
    }
}
