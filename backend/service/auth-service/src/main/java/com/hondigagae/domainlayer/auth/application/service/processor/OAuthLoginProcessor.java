package com.hondigagae.domainlayer.auth.application.service.processor;

import com.hondigagae.domainlayer.auth.application.exception.AuthErrorCode;
import com.hondigagae.domainlayer.auth.application.exception.AuthException;
import com.hondigagae.domainlayer.auth.application.info.GeneralLoginInfo;
import com.hondigagae.domainlayer.auth.application.info.OAuthAuthorizationInfo;
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
import com.hondigagae.domainlayer.member.application.service.support.EmailNormalizer;
import com.hondigagae.domainlayer.member.application.service.support.WithdrawnEmailHasher;
import com.hondigagae.domainlayer.member.domain.enums.MemberStatus;
import com.hondigagae.domainlayer.member.domain.enums.OAuthProvider;
import com.hondigagae.domainlayer.member.domain.model.Member;
import com.hondigagae.persistence.util.SnowflakeIdGenerator;
import com.hondigagae.security.common.enums.SecurityRole;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
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

    /**
     * state 의 수명. web 계층의 state 쿠키가 <b>같은 값</b>을 maxAge 로 쓰기 때문에 public 이다 —
     * 두 곳에 따로 적어 두면 한쪽만 고쳐졌을 때 쿠키와 Redis 의 수명이 갈리고, 쿠키가 먼저 죽으면
     * 아직 유효한 state 를 가진 정상 사용자가 거부된다.
     */
    public static final Duration STATE_TTL = Duration.ofMinutes(10);
    private static final int STATE_BYTE_LENGTH = 16;

    private final OAuthAuthorizationUrlRouter authorizationUrlRouter;
    private final OAuthMemberQueryRouter memberQueryRouter;
    private final OAuthStateStorePort oAuthStateStorePort;
    private final MemberRepositoryPort memberRepositoryPort;
    private final MemberConsentProcessor memberConsentProcessor;
    private final WithdrawnEmailHasher withdrawnEmailHasher;
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
     *
     * <p>state 원문을 URL 과 함께 돌려주는 것은 web 계층이 그 값을 쿠키로도 심어야 하기
     * 때문이다 — 쿠키에 묶이지 않은 state 는 "발급자의 주장"일 뿐이고, 그 주장으로 남의 동의
     * 이력을 만들 수 있다.
     */
    public OAuthAuthorizationInfo generateAuthorizationUrl(OAuthProvider provider, OAuthSignupConsent consent) {
        byte[] stateBytes = new byte[STATE_BYTE_LENGTH];
        secureRandom.nextBytes(stateBytes);
        String state = HexFormat.of().formatHex(stateBytes);

        oAuthStateStorePort.save(state, provider, consent, STATE_TTL);
        return OAuthAuthorizationInfo.of(authorizationUrlRouter.generateUrl(provider, state), state);
    }

    /**
     * provider 왕복(HTTP)만 담당한다. DB 트랜잭션 밖에서 호출해 커넥션 점유를 피한다.
     *
     * <p>state 소비는 일회성이라 여기서만 동의를 꺼낼 수 있다. 다음 단계(회원 조회/생성)는
     * 별도 트랜잭션이므로 프로필과 동의를 함께 묶어 돌려준다.
     *
     * @param cookieState 인가 시점에 브라우저로 내려보낸 state 쿠키 값. 없으면 {@code null}
     */
    public OAuthCallbackInfo fetchOAuthMember(OAuthProvider provider, String authCode, String state, String cookieState) {
        // 1. state 검증(쿠키 대조 + 일회성 소비) — 이 브라우저가 발급받은 요청인지, provider가
        //    바뀌지 않았는지 확인하고 인가 전에 받아 둔 동의를 함께 꺼낸다
        OAuthSignupConsent consent = validateState(provider, state, cookieState);

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
        String email = EmailNormalizer.normalize(oAuthMember.email());

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

    /**
     * state 가 <b>이 브라우저</b>의 것인지까지 확인한다(double-submit).
     *
     * <p>Redis 만 보면 인가 URL 을 발급받은 주체와 provider 에서 인증하는 주체가 다를 수 있다.
     * 공격자가 동의를 켠 인가 URL 을 피해자에게 클릭시키면 피해자 이름으로 동의 이력이 남는다.
     * 인가 응답에 심은 쿠키와 대조하면 그 state 는 공격자 브라우저에만 있으므로 거부된다.
     *
     * <p><b>쿠키 대조를 Redis 소비보다 먼저 한다.</b> 순서가 뒤집히면, 쿠키 불일치로 어차피
     * 거부될 요청이 멀쩡한 state 를 태워 버려 정상 사용자의 재시도까지 막는다.
     *
     * <p>쿠키가 아예 없는 요청도 거부한다. 사유는 기존 {@code INVALID_OAUTH_STATE} 그대로다 —
     * "쿠키가 없어서 막혔다"를 알려줄 이유가 없다. 배포 직후 10분(= state TTL)은 구버전
     * 프론트에서 온 콜백이 여기 걸리고, 사용자는 인가부터 다시 밟으면 된다.
     *
     * <p>비교는 {@link java.security.MessageDigest#isEqual(byte[], byte[])} 로 한다. 길이가 같으면
     * 상수 시간이라, 응답 시간 차이로 유효한 state 를 한 바이트씩 맞춰 볼 표면을 만들지 않는다.
     */
    private OAuthSignupConsent validateState(OAuthProvider provider, String state, String cookieState) {
        if (!StringUtils.hasText(state) || !StringUtils.hasText(cookieState)) {
            throw new AuthException(AuthErrorCode.INVALID_OAUTH_STATE);
        }

        if (!MessageDigest.isEqual(state.getBytes(StandardCharsets.UTF_8), cookieState.getBytes(StandardCharsets.UTF_8))) {
            // 원문을 남기지 않는다 — 로그가 유효한 state 를 그대로 들고 있게 된다
            log.warn("[OAuthLoginProcessor] oauth state cookie mismatch: provider={}", provider);
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
            // ⚠ 이 분기는 #609 이후 사실상 도달하지 않는다. 탈퇴 행의 email 은 다이제스트로
            //   치환돼 있어 호출부의 findByEmail(원문)에 애초에 잡히지 않기 때문이다. 마이그레이션
            //   전에 원문이 남아 있는 옛 탈퇴 행에만 해당한다.
            //   **재가입 차단의 실질 수단은 여기가 아니라 signupOAuthMember 의 validateNotWithdrawn**
            //   (다이제스트로 조회)이다. 이 분기를 근거로 그쪽을 "중복"이라며 지우면 그 순간
            //   소셜 재가입이 뚫린다.
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
        validateNotWithdrawn(email);
        validateSignupConsent(consent);

        Member created = createOAuthMember(provider, email, oAuthMember);
        // 이력 생성 규칙(필수 항목·박제할 버전·항목 간 같은 시각)은 member 컨텍스트의 단일 지점에
        // 있다. 여기서 직접 만들면 항목이 늘어날 때 소셜 경로만 옛 규칙으로 남는다.
        memberConsentProcessor.recordSignupConsents(created.id());
        return created;
    }

    /**
     * 탈퇴 이력이 있는 이메일이면 신규 가입을 막는다.
     *
     * <p><b>이 검사가 없으면 탈퇴자가 소셜로 재가입된다.</b> 탈퇴 회원의 {@code email} 은
     * 다이제스트로 치환돼 있어 원문 조회({@code findByEmail})에 잡히지 않고, 그대로 신규 생성
     * 경로로 빠진다. 원문을 보관하던 때 {@code resolveExistingMember} 가 막던 것과 <b>같은
     * 응답</b>({@code MEMBER_004})을 유지해 동작을 보존한다.
     *
     * <p>동의 검사보다 먼저 두는 것도 기존 동작 보존이다 — 예전에는 상태 판정이 동의 흐름보다
     * 앞이라, 탈퇴자는 동의 여부와 무관하게 {@code MEMBER_004} 를 받았다.
     *
     * <p>{@code findByEmail} 이 한 번 더 도는 것은 신규 가입 분기뿐이라 로그인 비용에 영향이 없다.
     *
     * <p><b>{@code resolveExistingMember} 의 {@code case WITHDRAWN} 이 이 검사를 대신하지 못한다.</b>
     * 그쪽은 원문 조회에 걸린 행만 보므로 마이그레이션 이전의 옛 행에만 해당한다. 중복으로 보고
     * 이 메서드를 지우면 재가입 차단이 그대로 뚫린다.
     */
    private void validateNotWithdrawn(String email) {
        if (memberRepositoryPort.findByEmail(withdrawnEmailHasher.hash(email)).isPresent()) {
            throw new MemberException(MemberErrorCode.MEMBER_ALREADY_WITHDRAWN);
        }
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
