package com.hondigagae.domainlayer.auth.application.service.processor;

import com.hondigagae.domainlayer.auth.application.info.AuthSessionInfo;
import com.hondigagae.domainlayer.auth.application.exception.AuthErrorCode;
import com.hondigagae.domainlayer.auth.application.exception.AuthException;
import com.hondigagae.domainlayer.auth.application.info.JwtTokenIssueInfo;
import com.hondigagae.domainlayer.auth.application.info.JwtTokenReissueInfo;
import com.hondigagae.domainlayer.auth.application.port.out.JwtTokenStorePort;
import com.hondigagae.domainlayer.member.application.exception.MemberErrorCode;
import com.hondigagae.domainlayer.member.application.exception.MemberException;
import com.hondigagae.domainlayer.member.application.port.out.MemberRepositoryPort;
import com.hondigagae.domainlayer.member.domain.model.Member;
import com.hondigagae.security.auth.jwt.JwtAuthProperties;
import com.hondigagae.security.auth.jwt.JwtAuthProvider;
import com.hondigagae.security.auth.jwt.JwtAuthProvider.RefreshTokenClaims;
import com.hondigagae.security.common.enums.SecurityRole;
import com.hondigagae.security.common.exception.SecurityJwtException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;

/**
 * 토큰 발급/재발급/무효화. refresh 토큰은 <b>기기(로그인)별 세션</b>으로 저장한다 —
 * 로그인/회전마다 새 sessionId(jti) 키가 발급되고 회전 시 이전 키를 지우므로,
 * 여러 기기가 서로의 세션을 덮어쓰지 않고 각자 독립적으로 재발급한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class JwtTokenProcessor {

    private final JwtAuthProvider jwtAuthProvider;
    private final JwtAuthProperties jwtAuthProperties;
    private final JwtTokenStorePort jwtTokenStorePort;
    private final MemberRepositoryPort memberRepositoryPort;

    public JwtTokenIssueInfo issueTokens(long memberId, SecurityRole role) {
        // 1. 새 기기 세션 아이디로 토큰 쌍 발급
        String sessionId = UUID.randomUUID().toString();
        String accessToken = jwtAuthProvider.issueAccessToken(memberId, role);
        String refreshToken = jwtAuthProvider.issueRefreshToken(memberId, sessionId);

        // 2. Save refresh token to Redis (세션별 키)
        jwtTokenStorePort.save(memberId, sessionId, refreshToken);

        return JwtTokenIssueInfo.of(memberId, role, accessToken, refreshToken);
    }

    /**
     * 로그아웃용 revoke — <b>현재 기기 세션만</b> 무효화한다. 다른 기기의 로그인은 유지된다.
     * 사용자 편의 경로이므로 Redis 장애 시에도 로그아웃 요청 자체는 성공시킨다(관용 처리).
     *
     * @param refreshToken 요청 쿠키의 refresh 토큰. 없거나 해석 불가하면(만료 등) 세션 삭제는
     *                     건너뛰고 access 토큰 블랙리스트만 등록한다 — 해당 세션은 어차피 만료됐거나
     *                     쿠키가 이미 사라진 상태다.
     */
    public void revokeCurrentSession(long memberId, String accessTokenId, String refreshToken) {
        try {
            resolveSessionId(memberId, refreshToken)
                .ifPresent(sessionId -> jwtTokenStorePort.deleteSession(memberId, sessionId));
            blacklistAccessToken(memberId, accessTokenId);
        } catch (DataAccessException e) {
            log.error("[JwtTokenProcessor] 로그아웃 revoke 실패(관용 처리): memberId={}, error={}", memberId, e.getMessage());
        }
    }

    /**
     * 보안 이벤트(탈퇴/비밀번호 변경/상태 이상)용 revoke — <b>전 기기 세션</b>을 무효화한다.
     * 실패를 전파해 호출 트랜잭션을 롤백시킨다 — "세션 무효화 없이 성공한 것처럼 보이는" 상태를
     * 만들지 않기 위함이다.
     */
    public void revokeAllSessions(long memberId, String tokenId) {
        jwtTokenStorePort.deleteAllSessions(memberId);
        blacklistAccessToken(memberId, tokenId);
    }

    public JwtTokenReissueInfo reissueTokens(String refreshToken) {
        // 1. Validate refresh token and extract member id + session id
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new AuthException(AuthErrorCode.EXPIRED_REFRESH_TOKEN);
        }
        RefreshTokenClaims claims = jwtAuthProvider.parseRefreshToken(refreshToken);
        long memberId = claims.memberId();

        // 2. Compare token with Redis value (세션 키 — 다른 기기 로그인으로 밀려났으면 재로그인 필요)
        String storedToken = jwtTokenStorePort.find(memberId, claims.tokenId())
            .orElseThrow(() -> new AuthException(AuthErrorCode.EXPIRED_REFRESH_TOKEN));

        if (!storedToken.equals(refreshToken)) {
            throw new AuthException(AuthErrorCode.INVALID_REFRESH_TOKEN);
        }

        // 3. Lookup member and validate status (정지/탈퇴 회원의 토큰 재발급 차단)
        Member member = memberRepositoryPort.findById(memberId)
            .orElseThrow(() -> new MemberException(MemberErrorCode.NOT_FOUND_MEMBER));
        validateReissuableStatus(member);

        // 4. Rotate — 옛 세션 삭제는 "저장값 == 제시 토큰"일 때만 성공하는 원자 연산이다.
        //    동시 재발급 두 건이 위의 비교(2)를 함께 통과해도 여기서는 한 건만 이기므로
        //    세션이 증식하지 않고, 탈취 토큰의 동시 재생도 한 건만 성공한다.
        //    진 쪽은 이미 회전된 토큰의 재사용과 같은 상태라 같은 코드로 거부한다.
        if (!jwtTokenStorePort.deleteSessionIfTokenMatches(member.id(), claims.tokenId(), refreshToken)) {
            throw new AuthException(AuthErrorCode.INVALID_REFRESH_TOKEN);
        }

        // 5. Issue — 새 sessionId 로 교체 회전한다. 같은 jti 를 유지하면 iat 가 초 단위라
        //    같은 초 안에서 동일 토큰이 재생성되어 회전이 무력화되기 때문이다.
        String newSessionId = UUID.randomUUID().toString();
        String newAccessToken = jwtAuthProvider.issueAccessToken(member.id(), member.role());
        String newRefreshToken = jwtAuthProvider.issueRefreshToken(member.id(), newSessionId);
        jwtTokenStorePort.save(member.id(), newSessionId, newRefreshToken);

        return JwtTokenReissueInfo.of(newAccessToken, newRefreshToken);
    }

    /**
     * 로그인 기기 목록. current 는 요청 쿠키의 refresh 토큰과 같은 세션인지다 —
     * access 토큰에는 세션 식별자가 없어 쿠키로만 판별하고, 쿠키가 없거나 해석 불가면 전부 false.
     */
    public List<AuthSessionInfo> listSessions(long memberId, String refreshToken) {
        String currentSessionId = resolveSessionId(memberId, refreshToken).orElse(null);
        return jwtTokenStorePort.findSessions(memberId).stream()
            .map(session -> AuthSessionInfo.builder()
                .sessionId(session.sessionId())
                .lastRefreshedAt(session.lastRefreshedAt())
                .current(session.sessionId().equals(currentSessionId))
                .build())
            .toList();
    }

    /**
     * 특정 기기 세션 무효화(원격 로그아웃). 멱등이다 — 이미 만료/삭제된 세션이어도 성공으로 본다.
     * 그 기기가 이미 발급받은 access 토큰은 만료 시까지 유효할 수 있다(비밀번호 변경과 같은 한계).
     */
    public void revokeSession(long memberId, String sessionId) {
        jwtTokenStorePort.deleteSession(memberId, sessionId);
    }

    /** 쿠키의 refresh 토큰에서 세션 아이디를 추출한다. 위조/타인 토큰이면 세션을 건드리지 않는다. */
    private Optional<String> resolveSessionId(long memberId, String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return Optional.empty();
        }
        try {
            RefreshTokenClaims claims = jwtAuthProvider.parseRefreshToken(refreshToken);
            if (claims.memberId() != memberId) {
                log.warn("[JwtTokenProcessor] 로그아웃 쿠키의 refresh 토큰 소유자가 불일치: memberId={}", memberId);
                return Optional.empty();
            }
            return Optional.of(claims.tokenId());
        } catch (SecurityJwtException e) {
            // 만료/위조 refresh — 세션 삭제 없이 진행한다 (만료면 키도 곧/이미 사라진다).
            return Optional.empty();
        }
    }

    private void blacklistAccessToken(long memberId, String tokenId) {
        if (tokenId == null || tokenId.isBlank()) {
            log.warn("[JwtTokenProcessor] revoke 요청에 tokenId 누락: memberId={}", memberId);
            return;
        }
        jwtTokenStorePort.saveAccessTokenIdBlacklist(tokenId, jwtAuthProperties.accessExpiration());
    }

    private void validateReissuableStatus(Member member) {
        switch (member.status()) {
            case WITHDRAWN -> {
                jwtTokenStorePort.deleteAllSessions(member.id());
                throw new MemberException(MemberErrorCode.MEMBER_ALREADY_WITHDRAWN);
            }
            case SUSPENDED -> {
                jwtTokenStorePort.deleteAllSessions(member.id());
                throw new MemberException(MemberErrorCode.MEMBER_SUSPENDED);
            }
            case ACTIVE -> {
            } // 정상
        }
    }
}
