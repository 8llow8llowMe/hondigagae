package com.hondigagae.domainlayer.auth.application.service.processor;

import com.hondigagae.domainlayer.auth.application.exception.AuthErrorCode;
import com.hondigagae.domainlayer.auth.application.exception.AuthException;
import com.hondigagae.domainlayer.auth.application.info.GeneralLoginInfo;
import com.hondigagae.domainlayer.auth.application.port.out.MailSendPort;
import com.hondigagae.domainlayer.auth.application.port.out.OAuthStateStorePort;
import com.hondigagae.domainlayer.auth.application.port.out.query.OAuthMemberQueryResult;
import com.hondigagae.domainlayer.auth.application.service.oauth.OAuthAuthorizationUrlRouter;
import com.hondigagae.domainlayer.auth.application.service.oauth.OAuthMemberQueryRouter;
import com.hondigagae.domainlayer.member.application.exception.MemberErrorCode;
import com.hondigagae.domainlayer.member.application.exception.MemberException;
import com.hondigagae.domainlayer.member.application.port.out.MemberRepositoryPort;
import com.hondigagae.domainlayer.member.domain.enums.MemberStatus;
import com.hondigagae.domainlayer.member.domain.enums.OAuthProvider;
import com.hondigagae.domainlayer.member.domain.model.Member;
import com.hondigagae.persistence.util.SnowflakeIdGenerator;
import com.hondigagae.security.common.enums.SecurityRole;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.HexFormat;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Slf4j
@Service
@RequiredArgsConstructor
public class OAuthLoginProcessor {

    private static final Duration STATE_TTL = Duration.ofMinutes(10);
    private static final int STATE_BYTE_LENGTH = 16;

    private final OAuthAuthorizationUrlRouter authorizationUrlRouter;
    private final OAuthMemberQueryRouter memberQueryRouter;
    private final OAuthStateStorePort oAuthStateStorePort;
    private final MemberRepositoryPort memberRepositoryPort;
    private final MailSendPort mailSendPort;
    private final SnowflakeIdGenerator snowflakeIdGenerator;
    private final SecureRandom secureRandom = new SecureRandom();

    /**
     * CSRF 방어용 일회성 state를 발급해 인가 URL에 포함시킨다.
     */
    public String generateAuthorizationUrl(OAuthProvider provider) {
        byte[] stateBytes = new byte[STATE_BYTE_LENGTH];
        secureRandom.nextBytes(stateBytes);
        String state = HexFormat.of().formatHex(stateBytes);

        oAuthStateStorePort.save(state, provider, STATE_TTL);
        return authorizationUrlRouter.generateUrl(provider, state);
    }

    /**
     * provider 왕복(HTTP)만 담당한다. DB 트랜잭션 밖에서 호출해 커넥션 점유를 피한다.
     */
    public OAuthMemberQueryResult fetchOAuthMember(OAuthProvider provider, String authCode, String state) {
        // 1. state 검증(일회성 소비) — 우리가 발급한 요청인지, provider가 바뀌지 않았는지 확인
        validateState(provider, state);

        // 2. provider로부터 사용자 프로필 조회 및 필수 항목(부분 동의) 검증
        OAuthMemberQueryResult oAuthMember = memberQueryRouter.fetchMember(provider, authCode, state);
        validateRequiredProfile(oAuthMember);

        return oAuthMember;
    }

    /**
     * 조회한 프로필로 회원을 조회/생성한다. 외부 HTTP를 포함하지 않는 이 구간만 트랜잭션 대상이다.
     */
    @Transactional
    public GeneralLoginInfo login(OAuthProvider provider, OAuthMemberQueryResult oAuthMember) {
        String email = EmailVerificationProcessor.normalize(oAuthMember.email());

        Member member = memberRepositoryPort.findByEmail(email)
            .map(existing -> resolveExistingMember(existing, provider, oAuthMember))
            .orElseGet(() -> createOAuthMember(provider, email, oAuthMember));

        return GeneralLoginInfo.of(member.id(), member.role());
    }

    private void validateRequiredProfile(OAuthMemberQueryResult oAuthMember) {
        if (!StringUtils.hasText(oAuthMember.email())) {
            throw new AuthException(AuthErrorCode.OAUTH_EMAIL_REQUIRED);
        }

        // provider 가 "미검증"이라고 명시한 이메일은 신뢰하지 않는다 (카카오의 is_email_verified=false).
        // null(검증 여부 미상 — 네이버)은 로그인 자체는 허용하되, 기존 계정 자동 연결만
        // resolveExistingMember 에서 차단한다 — 미상 이메일 연결은 계정 탈취 경로다.
        if (Boolean.FALSE.equals(oAuthMember.emailVerified())) {
            throw new AuthException(AuthErrorCode.OAUTH_EMAIL_UNVERIFIED);
        }

        // nickname/name은 회원 필수 컬럼이라 미동의 시 DB 제약 위반 대신 명확한 사유로 거부한다.
        if (!StringUtils.hasText(oAuthMember.nickname()) && !StringUtils.hasText(oAuthMember.name())) {
            throw new AuthException(AuthErrorCode.OAUTH_PROFILE_REQUIRED);
        }
    }

    private void validateState(OAuthProvider provider, String state) {
        if (!StringUtils.hasText(state)) {
            throw new AuthException(AuthErrorCode.INVALID_OAUTH_STATE);
        }

        OAuthProvider savedProvider = oAuthStateStorePort.consume(state)
            .orElseThrow(() -> new AuthException(AuthErrorCode.INVALID_OAUTH_STATE));

        if (savedProvider != provider) {
            throw new AuthException(AuthErrorCode.INVALID_OAUTH_STATE);
        }
    }

    private Member resolveExistingMember(Member existing, OAuthProvider provider, OAuthMemberQueryResult oAuthMember) {
        // 상태 먼저 확인 — 탈퇴/정지 회원은 소셜 로그인도 차단
        switch (existing.status()) {
            case WITHDRAWN -> throw new MemberException(MemberErrorCode.MEMBER_ALREADY_WITHDRAWN);
            case SUSPENDED -> throw new MemberException(MemberErrorCode.MEMBER_SUSPENDED);
            case ACTIVE -> {
            } // 정상
        }

        // 일반 계정이면 소셜 계정으로 연결한다 — 단, provider 가 이메일 소유를 검증한 경우에만.
        // 검증 여부 미상(네이버)인 이메일로 연결하면 피해자 이메일을 연락처로 등록한 공격자가
        // 비밀번호 없이 기존 계정을 가로챌 수 있다. 이때는 기존 방식 로그인으로 유도한다.
        if (existing.provider() == null) {
            if (!Boolean.TRUE.equals(oAuthMember.emailVerified())) {
                throw new AuthException(AuthErrorCode.OAUTH_LINK_REQUIRES_VERIFIED_EMAIL);
            }
            log.info("[OAuthLoginProcessor] 일반 계정을 소셜 계정으로 연결: memberId={}, provider={}", existing.id(), provider);
            Member linked = memberRepositoryPort.save(existing.withProvider(provider));
            // 연결 사실을 메일로 통보한다 — 본인이 한 게 아니면 즉시 알아챌 수 있는 탈취 감지 수단.
            // 비동기 발송이라 로그인 흐름을 막지 않고, 실패해도 로그인은 성공한다.
            mailSendPort.sendSocialLinkedNotice(linked.email(), provider.getDescription());
            return linked;
        }

        // 다른 provider로 가입된 계정이면 차단
        if (existing.provider() != provider) {
            throw new AuthException(AuthErrorCode.UNMATCHED_OAUTH_PROVIDER, existing.provider().getDescription());
        }
        return existing;
    }

    private Member createOAuthMember(OAuthProvider provider, String email, OAuthMemberQueryResult oAuthMember) {
        Member newMember = Member.builder()
            .id(snowflakeIdGenerator.generateId())
            .email(email)
            .password(null)
            .name(StringUtils.hasText(oAuthMember.name()) ? oAuthMember.name() : oAuthMember.nickname())
            .nickname(oAuthMember.nickname())
            .profileImageUrl(oAuthMember.profileImageUrl())
            .role(SecurityRole.USER)
            .provider(provider)
            .status(MemberStatus.ACTIVE)
            .build();

        return memberRepositoryPort.save(newMember);
    }
}
