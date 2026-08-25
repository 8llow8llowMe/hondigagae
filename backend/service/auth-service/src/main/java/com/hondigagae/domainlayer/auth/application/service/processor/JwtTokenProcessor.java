package com.hondigagae.domainlayer.auth.application.service.processor;

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
import com.hondigagae.security.common.enums.SecurityRole;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class JwtTokenProcessor {

    private final JwtAuthProvider jwtAuthProvider;
    private final JwtAuthProperties jwtAuthProperties;
    private final JwtTokenStorePort jwtTokenStorePort;
    private final MemberRepositoryPort memberRepositoryPort;

    public JwtTokenIssueInfo issueTokens(long memberId, SecurityRole role) {
        // 1. Issue token pair
        String accessToken = jwtAuthProvider.issueAccessToken(memberId, role);
        String refreshToken = jwtAuthProvider.issueRefreshToken(memberId);

        // 2. Save refresh token to Redis
        jwtTokenStorePort.save(memberId, refreshToken);

        return JwtTokenIssueInfo.of(memberId, role, accessToken, refreshToken);
    }

    /**
     * 로그아웃용 revoke. 사용자 편의 경로이므로 Redis 장애 시에도 로그아웃 요청 자체는 성공시킨다(관용 처리).
     */
    public void revokeToken(long memberId, String tokenId) {
        try {
            revokeAllSessions(memberId, tokenId);
        } catch (DataAccessException e) {
            log.error("[JwtTokenProcessor] 로그아웃 revoke 실패(관용 처리): memberId={}, error={}", memberId, e.getMessage());
        }
    }

    /**
     * 보안 이벤트(탈퇴/비밀번호 변경)용 revoke. 실패를 전파해 호출 트랜잭션을 롤백시킨다 —
     * "세션 무효화 없이 성공한 것처럼 보이는" 상태를 만들지 않기 위함이다.
     */
    public void revokeAllSessions(long memberId, String tokenId) {
        // 1. Delete refresh token (회원당 단일 슬롯이므로 전 세션의 재발급이 차단된다)
        jwtTokenStorePort.delete(memberId);

        // 2. Register current access token id blacklist
        if (tokenId == null || tokenId.isBlank()) {
            log.warn("[JwtTokenProcessor] revoke 요청에 tokenId 누락: memberId={}", memberId);
            return;
        }

        jwtTokenStorePort.saveAccessTokenIdBlacklist(tokenId, jwtAuthProperties.accessExpiration());
    }

    public JwtTokenReissueInfo reissueTokens(String refreshToken) {
        // 1. Validate refresh token and extract member id
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new AuthException(AuthErrorCode.EXPIRED_REFRESH_TOKEN);
        }
        long memberId = jwtAuthProvider.parseRefreshToken(refreshToken);

        // 2. Compare token with Redis value
        String storedToken = jwtTokenStorePort.find(memberId)
            .orElseThrow(() -> new AuthException(AuthErrorCode.EXPIRED_REFRESH_TOKEN));

        if (!storedToken.equals(refreshToken)) {
            throw new AuthException(AuthErrorCode.INVALID_REFRESH_TOKEN);
        }

        // 3. Lookup member and validate status (정지/탈퇴 회원의 토큰 재발급 차단)
        Member member = memberRepositoryPort.findById(memberId)
            .orElseThrow(() -> new MemberException(MemberErrorCode.NOT_FOUND_MEMBER));
        validateReissuableStatus(member);

        // 4. Issue and rotate tokens
        String newAccessToken = jwtAuthProvider.issueAccessToken(member.id(), member.role());
        String newRefreshToken = jwtAuthProvider.issueRefreshToken(member.id());
        jwtTokenStorePort.save(member.id(), newRefreshToken);

        return JwtTokenReissueInfo.of(newAccessToken, newRefreshToken);
    }

    private void validateReissuableStatus(Member member) {
        switch (member.status()) {
            case WITHDRAWN -> {
                jwtTokenStorePort.delete(member.id());
                throw new MemberException(MemberErrorCode.MEMBER_ALREADY_WITHDRAWN);
            }
            case SUSPENDED -> {
                jwtTokenStorePort.delete(member.id());
                throw new MemberException(MemberErrorCode.MEMBER_SUSPENDED);
            }
            case ACTIVE -> {
            } // 정상
        }
    }
}
