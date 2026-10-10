package com.hondigagae.security.auth.jwt;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.security.common.dto.MemberLoginActive;
import com.hondigagae.security.common.enums.SecurityRole;
import com.hondigagae.security.common.exception.SecurityErrorCode;
import com.hondigagae.security.common.exception.SecurityJwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.time.Duration;
import java.util.Date;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * 토큰 파싱 실패가 <b>전부</b> {@link SecurityJwtException} 으로 나오는지 고정한다 (이슈 #214).
 *
 * <p>필터는 이 예외만 잡아 401 을 쓴다. 다른 예외가 새면 Spring 기본 500 이 래퍼 없이 나가고,
 * FE 는 그것을 "일시 장애 · 재시도" 로 안내한다 — 재시도해도 절대 풀리지 않는 인증 오류인데.
 * 그래서 어떤 모양의 토큰이 와도 여기서 새는 예외가 없어야 한다.
 */
class JwtAuthProviderTest {

    private static final String ACCESS_KEY = "hondigagae-test-jwt-access-key-0123456789abcdef0123456789abcdef0123456789abcdef";
    private static final String OTHER_KEY = "hondigagae-test-jwt-other--key-0123456789abcdef0123456789abcdef0123456789abcdef";
    private static final String REFRESH_KEY = "hondigagae-test-jwt-refresh-key-0123456789abcdef0123456789abcdef0123456789abcdef";

    private final JwtAuthProvider provider = new JwtAuthProvider(
        new JwtAuthProperties(ACCESS_KEY, Duration.ofMinutes(30), REFRESH_KEY, Duration.ofDays(14)));

    @Test
    @DisplayName("정상 토큰은 회원 식별자·권한·jti 를 돌려준다")
    void parsesIssuedToken() {
        String token = provider.issueAccessToken(42L, SecurityRole.USER);

        MemberLoginActive member = provider.parseAccessToken(token);

        assertThat(member.memberId()).isEqualTo(42L);
        assertThat(member.role()).isEqualTo(SecurityRole.USER);
        assertThat(member.tokenId()).isNotBlank();
    }

    /** 이슈 #214 표의 Authorization 갈래. 게이트웨이가 답하는 "헤더 없음(403)" 은 이 클래스의 범위가 아니다. */
    static Stream<Arguments> malformedTokens() {
        String header = "eyJhbGciOiJIUzI1NiJ9";
        String payload = "eyJzdWIiOiIxIn0";
        return Stream.of(
            Arguments.of("2파트 — aa.bb", "aa.bb", SecurityErrorCode.TOKEN_INVALID),
            Arguments.of("디코딩 불가 문자 — h.p.!!!", header + "." + payload + ".!!!", SecurityErrorCode.TOKEN_INVALID),
            Arguments.of("서명 불일치 — h.p.AAAA", header + "." + payload + ".AAAA", SecurityErrorCode.TOKEN_SIGNATURE_INVALID),
            // 이슈의 재현 케이스. base64url 로 디코딩할 수 없는 길이(1글자)의 서명이 500 으로 새던 갈래다.
            Arguments.of("디코딩 불가 길이 — h.p.x (이슈 재현)", header + "." + payload + ".x", SecurityErrorCode.TOKEN_INVALID),
            Arguments.of("빈 문자열", "", SecurityErrorCode.TOKEN_INVALID),
            Arguments.of("서명 없는 JWT (alg none 형태)", header + "." + payload + ".", SecurityErrorCode.TOKEN_INVALID)
        );
    }

    @ParameterizedTest(name = "{0} → {2}")
    @MethodSource("malformedTokens")
    @DisplayName("형식이 깨진 토큰은 예외 종류와 무관하게 SecurityJwtException 으로 나온다")
    void mapsMalformedTokens(String description, String token, SecurityErrorCode expected) {
        assertThatThrownBy(() -> provider.parseAccessToken(token))
            .isInstanceOf(SecurityJwtException.class)
            .extracting(exception -> ((SecurityJwtException) exception).getErrorCode())
            .isEqualTo(expected);
    }

    @Test
    @DisplayName("만료 + 서명 불일치는 서명 검증 실패다 — 서명을 못 믿으면 만료 클레임도 못 믿는다")
    void expiredWithWrongSignatureIsSignatureFailure() {
        String token = signedWith(OTHER_KEY, "1", SecurityRole.USER.name(), new Date(System.currentTimeMillis() - 60_000));

        assertThatThrownBy(() -> provider.parseAccessToken(token))
            .isInstanceOf(SecurityJwtException.class)
            .extracting(exception -> ((SecurityJwtException) exception).getErrorCode())
            .isEqualTo(SecurityErrorCode.TOKEN_SIGNATURE_INVALID);
    }

    @Test
    @DisplayName("서명은 맞지만 만료된 토큰은 TOKEN_EXPIRED")
    void expiredTokenWithValidSignature() {
        String token = signedWith(ACCESS_KEY, "1", SecurityRole.USER.name(), new Date(System.currentTimeMillis() - 60_000));

        assertThatThrownBy(() -> provider.parseAccessToken(token))
            .isInstanceOf(SecurityJwtException.class)
            .extracting(exception -> ((SecurityJwtException) exception).getErrorCode())
            .isEqualTo(SecurityErrorCode.TOKEN_EXPIRED);
    }

    /**
     * 서명이 맞아도 클레임이 우리 발급 규약과 다르면 500 이 아니라 401 이다. 키가 새지 않으면 만들 수 없는
     * 토큰이지만, 만들 수 있게 됐을 때 서버 내부 오류로 보이게 두면 안 된다.
     */
    static Stream<Arguments> validSignatureBrokenClaims() {
        Date future = new Date(System.currentTimeMillis() + 60_000);
        return Stream.of(
            Arguments.of("subject 가 숫자가 아님", signedWith(ACCESS_KEY, "not-a-number", SecurityRole.USER.name(), future)),
            Arguments.of("role 클레임 없음", signedWith(ACCESS_KEY, "1", null, future)),
            Arguments.of("role 이 알 수 없는 값", signedWith(ACCESS_KEY, "1", "SUPERUSER", future)),
            Arguments.of("subject 없음", signedWith(ACCESS_KEY, null, SecurityRole.USER.name(), future))
        );
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("validSignatureBrokenClaims")
    @DisplayName("서명은 맞지만 클레임이 규약과 다른 토큰은 TOKEN_INVALID")
    void mapsBrokenClaims(String description, String token) {
        assertThatThrownBy(() -> provider.parseAccessToken(token))
            .isInstanceOf(SecurityJwtException.class)
            .extracting(exception -> ((SecurityJwtException) exception).getErrorCode())
            .isEqualTo(SecurityErrorCode.TOKEN_INVALID);
    }

    @Test
    @DisplayName("refresh 토큰도 같은 규칙으로 실패한다 — access 키로 서명된 토큰을 refresh 로 내면 서명 실패")
    void refreshTokenParsedWithSameRules() {
        String accessToken = provider.issueAccessToken(1L, SecurityRole.USER);

        assertThatThrownBy(() -> provider.parseRefreshToken(accessToken))
            .isInstanceOf(SecurityJwtException.class)
            .extracting(exception -> ((SecurityJwtException) exception).getErrorCode())
            .isEqualTo(SecurityErrorCode.TOKEN_SIGNATURE_INVALID);
        assertThatThrownBy(() -> provider.parseRefreshToken("h.p.x"))
            .isInstanceOf(SecurityJwtException.class);
    }

    private static String signedWith(String key, String subject, String role, Date expiration) {
        var builder = Jwts.builder().id("jti").subject(subject).expiration(expiration);
        if (role != null) {
            builder.claim("role", role);
        }
        return builder.signWith(Keys.hmacShaKeyFor(key.getBytes()), Jwts.SIG.HS512).compact();
    }
}
