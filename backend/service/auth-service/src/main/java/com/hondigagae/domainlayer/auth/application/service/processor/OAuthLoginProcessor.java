package com.hondigagae.domainlayer.auth.application.service.processor;

import com.hondigagae.domainlayer.auth.application.exception.AuthErrorCode;
import com.hondigagae.domainlayer.auth.application.exception.AuthException;
import com.hondigagae.domainlayer.auth.application.info.GeneralLoginInfo;
import com.hondigagae.domainlayer.auth.application.info.OAuthCallbackInfo;
import com.hondigagae.domainlayer.auth.application.model.OAuthSignupConsent;
import com.hondigagae.domainlayer.auth.application.port.out.MailSendPort;
import com.hondigagae.domainlayer.auth.application.port.out.OAuthStateStorePort;
import com.hondigagae.domainlayer.auth.application.port.out.query.OAuthMemberQueryResult;
import com.hondigagae.domainlayer.auth.application.port.out.query.OAuthStateQueryResult;
import com.hondigagae.domainlayer.auth.application.service.oauth.OAuthAuthorizationUrlRouter;
import com.hondigagae.domainlayer.auth.application.service.oauth.OAuthMemberQueryRouter;
import com.hondigagae.domainlayer.member.application.exception.MemberErrorCode;
import com.hondigagae.domainlayer.member.application.exception.MemberException;
import com.hondigagae.domainlayer.member.application.port.out.MemberRepositoryPort;
import com.hondigagae.domainlayer.member.application.service.processor.MemberConsentProcessor;
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
    private final MemberConsentProcessor memberConsentProcessor;
    private final MailSendPort mailSendPort;
    private final SnowflakeIdGenerator snowflakeIdGenerator;
    private final SecureRandom secureRandom = new SecureRandom();

    /**
     * CSRF 방어용 일회성 state를 발급해 인가 URL에 포함시킨다.
     *
     * <p>신규 가입 동의를 <b>여기서</b> 받아 state 와 함께 보관한다. 콜백에서 받지 않는 이유는
     * OAuth 인가코드가 1회용이기 때문이다 — 콜백에서 동의 누락으로 거부하면 같은 코드로는
     * 재시도할 수 없고, 사용자는 provider 인가 화면부터 다시 밟아야 한다. 인가 전에 받아 두면
     * 동의 없이 눌러도 우리 화면에서 되돌릴 수 있다.
     */
    public String generateAuthorizationUrl(OAuthProvider provider, OAuthSignupConsent consent) {
        byte[] stateBytes = new byte[STATE_BYTE_LENGTH];
        secureRandom.nextBytes(stateBytes);
        String state = HexFormat.of().formatHex(stateBytes);

        oAuthStateStorePort.save(state, provider, consent, STATE_TTL);
        return authorizationUrlRouter.generateUrl(provider, state);
    }

    /**
     * provider 왕복(HTTP)만 담당한다. DB 트랜잭션 밖에서 호출해 커넥션 점유를 피한다.
     *
     * <p>state 소비는 일회성이라 여기서만 동의를 꺼낼 수 있다. 다음 단계(회원 조회/생성)는
     * 별도 트랜잭션이므로 프로필과 동의를 함께 묶어 돌려준다.
     */
    public OAuthCallbackInfo fetchOAuthMember(OAuthProvider provider, String authCode, String state) {
        // 1. state 검증(일회성 소비) — 우리가 발급한 요청인지, provider가 바뀌지 않았는지 확인하고
        //    인가 전에 받아 둔 동의를 함께 꺼낸다
        OAuthSignupConsent consent = validateState(provider, state);

        // 2. provider로부터 사용자 프로필 조회 및 필수 항목(부분 동의) 검증
        OAuthMemberQueryResult oAuthMember = memberQueryRouter.fetchMember(provider, authCode, state);
        validateRequiredProfile(oAuthMember);

        return new OAuthCallbackInfo(oAuthMember, consent);
    }

    /**
     * 조회한 프로필로 회원을 조회/생성한다. 외부 HTTP를 포함하지 않는 이 구간만 트랜잭션 대상이라,
     * 신규 회원과 그 동의 이력은 한 트랜잭션에 묶여 함께 커밋되거나 함께 사라진다.
     *
     * <p>consent 는 <b>신규 생성 경로에서만</b> 본다. 이미 가입한 회원에게 로그인할 때마다 소급
     * 동의를 요구하지 않는 것이 이 서비스의 방침이다 — 동의는 수집·이용 시점에 받는 것이고,
     * 재동의는 문서 개정 시 별도 흐름으로 다룰 일이다.
     */
    @Transactional
    public GeneralLoginInfo login(OAuthProvider provider, OAuthCallbackInfo callbackInfo) {
        OAuthMemberQueryResult oAuthMember = callbackInfo.member();
        String email = EmailVerificationProcessor.normalize(oAuthMember.email());

        Member member = memberRepositoryPort.findByEmail(email)
            .map(existing -> resolveExistingMember(existing, provider, oAuthMember))
            .orElseGet(() -> signupOAuthMember(provider, email, oAuthMember, callbackInfo.consent()));

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

    private OAuthSignupConsent validateState(OAuthProvider provider, String state) {
        if (!StringUtils.hasText(state)) {
            throw new AuthException(AuthErrorCode.INVALID_OAUTH_STATE);
        }

        OAuthStateQueryResult saved = oAuthStateStorePort.consume(state)
            .orElseThrow(() -> new AuthException(AuthErrorCode.INVALID_OAUTH_STATE));

        if (saved.provider() != provider) {
            throw new AuthException(AuthErrorCode.INVALID_OAUTH_STATE);
        }
        return saved.consent();
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

    /**
     * 소셜 최초 연동 = 신규 가입이다. 그래서 일반 가입과 같은 기준으로 동의·확인을 요구하고,
     * 같은 모양의 이력을 남긴다.
     */
    private Member signupOAuthMember(
        OAuthProvider provider, String email, OAuthMemberQueryResult oAuthMember, OAuthSignupConsent consent
    ) {
        validateSignupConsent(consent);

        Member created = createOAuthMember(provider, email, oAuthMember);
        // 이력 생성 규칙(필수 항목·박제할 버전·항목 간 같은 시각)은 member 컨텍스트의 단일 지점에
        // 있다. 여기서 직접 만들면 항목이 늘어날 때 소셜 경로만 옛 규칙으로 남는다.
        memberConsentProcessor.recordSignupConsents(created.id());
        return created;
    }

    /**
     * 거부 사유를 <b>항목별로 갈라</b> 던진다. 하나로 뭉뚱그리면 프론트가 어느 체크박스를 강조할지
     * 알 수 없어서, 사용자는 "동의를 다 했는데 왜 안 되지"를 겪는다. 콜백은 인가코드를 이미 태운
     * 뒤라 되돌아갈 곳이 동의 화면뿐이고, 그래서 사유가 정확해야 한다.
     *
     * <p>문서 동의를 먼저 본다 — 두 종류가 함께 비어 있으면 {@code MEMBER_010} 이 나가는 것이
     * 이 경로의 기존 동작이고, 만 14세 확인은 그 뒤에 붙은 분기다.
     */
    private void validateSignupConsent(OAuthSignupConsent consent) {
        if (consent.agreedAll()) {
            return;
        }
        if (!consent.termsAgreed() || !consent.privacyAgreed()) {
            throw new MemberException(MemberErrorCode.CONSENT_REQUIRED);
        }
        throw new MemberException(MemberErrorCode.AGE_REQUIREMENT_NOT_MET);
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
