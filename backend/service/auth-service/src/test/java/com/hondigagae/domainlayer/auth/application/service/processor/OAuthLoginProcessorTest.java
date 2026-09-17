package com.hondigagae.domainlayer.auth.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.auth.application.info.GeneralLoginInfo;
import com.hondigagae.domainlayer.auth.application.info.OAuthCallbackInfo;
import com.hondigagae.domainlayer.auth.application.model.OAuthSignupConsent;
import com.hondigagae.domainlayer.auth.application.port.out.MailSendPort;
import com.hondigagae.domainlayer.auth.application.port.out.OAuthAuthorizationUrlProvider;
import com.hondigagae.domainlayer.auth.application.port.out.OAuthStateStorePort;
import com.hondigagae.domainlayer.auth.application.port.out.query.OAuthMemberQueryResult;
import com.hondigagae.domainlayer.auth.application.port.out.query.OAuthStateQueryResult;
import com.hondigagae.domainlayer.auth.application.service.oauth.OAuthAuthorizationUrlRouter;
import com.hondigagae.domainlayer.auth.application.service.oauth.OAuthMemberQueryRouter;
import com.hondigagae.domainlayer.member.application.exception.MemberErrorCode;
import com.hondigagae.domainlayer.member.application.exception.MemberException;
import com.hondigagae.domainlayer.member.application.port.out.MemberConsentRepositoryPort;
import com.hondigagae.domainlayer.member.application.port.out.MemberRepositoryPort;
import com.hondigagae.domainlayer.member.application.service.processor.MemberConsentProcessor;
import com.hondigagae.domainlayer.member.application.service.support.WithdrawnEmailHasher;
import com.hondigagae.domainlayer.member.domain.enums.MemberStatus;
import com.hondigagae.domainlayer.member.domain.enums.OAuthProvider;
import com.hondigagae.domainlayer.member.domain.model.Member;
import com.hondigagae.domainlayer.member.domain.model.MemberConsent;
import com.hondigagae.global.properties.LegalDocumentProperties;
import com.hondigagae.global.properties.WithdrawnEmailProperties;
import com.hondigagae.persistence.util.SnowflakeIdGenerator;
import com.hondigagae.security.common.enums.SecurityRole;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 소셜 로그인의 동의 처리 검증.
 *
 * <p>이 경로의 어려움은 동의를 받는 시점과 쓰는 시점이 다르다는 것이다 — 인가 URL 을 만들 때
 * 받아서 state 에 얹어 두고, 콜백에서 신규 회원을 만들 때 꺼내 쓴다. 그래서 확인할 것이 셋이다:
 * 신규면 동의가 필수인가, 동의가 이력으로 남는가, 그리고 <b>기존 회원은 건드리지 않는가</b>.
 */
class OAuthLoginProcessorTest {

    private static final OAuthProvider PROVIDER = OAuthProvider.KAKAO;
    private static final String EMAIL = "tester@example.com";
    private static final String TEST_PEPPER = "oauth-login-test-pepper-0123456789abcdef";

    private StubOAuthStateStorePort stateStorePort;
    private StubMemberRepositoryPort memberRepositoryPort;
    private RecordingConsentRepositoryPort consentRepositoryPort;
    private WithdrawnEmailHasher withdrawnEmailHasher;
    private OAuthLoginProcessor processor;

    @BeforeEach
    void setUp() {
        stateStorePort = new StubOAuthStateStorePort();
        memberRepositoryPort = new StubMemberRepositoryPort();
        consentRepositoryPort = new RecordingConsentRepositoryPort();
        // 프로필 조회 라우터는 provider 왕복(HTTP) 전용이라 이 테스트가 보는 경로에서는 쓰이지 않는다.
        // 동의 프로세서는 실물을 쓴다 — 소셜 경로가 일반 가입과 같은 규칙을 탄다는 것이 요점이다.
        // 이력의 내용(항목·버전·시각)은 MemberConsentProcessorTest 가 본다.
        MemberConsentProcessor consentProcessor = new MemberConsentProcessor(
            consentRepositoryPort, new SnowflakeIdGenerator(1, 1), new LegalDocumentProperties("1.0", "1.2"));
        // 해시는 실물을 쓴다 — 탈퇴 차단이 "탈퇴 시 저장한 값"과 "로그인 시 계산한 값"이 같다는
        // 전제 위에 서 있어서, 그 계산을 스텁으로 바꾸면 검증할 것이 남지 않는다.
        withdrawnEmailHasher = new WithdrawnEmailHasher(new WithdrawnEmailProperties(TEST_PEPPER));
        processor = new OAuthLoginProcessor(
            new OAuthAuthorizationUrlRouter(Set.of(new StubAuthorizationUrlProvider())),
            new OAuthMemberQueryRouter(Set.of()),
            stateStorePort,
            memberRepositoryPort,
            consentProcessor,
            withdrawnEmailHasher,
            new NoOpMailSendPort(),
            new SnowflakeIdGenerator(1, 1));
    }

    @Test
    @DisplayName("신규 회원은 동의·확인을 모두 받았을 때 생성되고 이력 3건이 남는다")
    void createsMemberAndRecordsConsentsWhenAgreedAll() {
        GeneralLoginInfo loginInfo = processor.login(PROVIDER, callback(new OAuthSignupConsent(true, true, true)));

        assertThat(memberRepositoryPort.findByEmail(EMAIL)).isPresent();
        assertThat(consentRepositoryPort.saved).hasSize(3);
        assertThat(consentRepositoryPort.saved).allSatisfy(
            consent -> assertThat(consent.memberId()).isEqualTo(loginInfo.memberId()));
    }

    @Test
    @DisplayName("신규 회원이 이용약관에 동의하지 않았으면 회원도 만들지 않고 거부한다")
    void rejectsNewMemberWithoutTermsAgreement() {
        assertThatThrownBy(() -> processor.login(PROVIDER, callback(new OAuthSignupConsent(false, true, true))))
            .isInstanceOf(MemberException.class)
            .hasFieldOrPropertyWithValue("errorCode", MemberErrorCode.CONSENT_REQUIRED);

        // 거부는 회원 생성 "전"이어야 한다. 만들고 나서 막으면 동의 없는 계정이 남는다.
        assertThat(memberRepositoryPort.findByEmail(EMAIL)).isEmpty();
        assertThat(consentRepositoryPort.saved).isEmpty();
    }

    @Test
    @DisplayName("신규 회원이 개인정보 처리방침에 동의하지 않았으면 거부한다")
    void rejectsNewMemberWithoutPrivacyAgreement() {
        assertThatThrownBy(() -> processor.login(PROVIDER, callback(new OAuthSignupConsent(true, false, true))))
            .isInstanceOf(MemberException.class)
            .hasFieldOrPropertyWithValue("errorCode", MemberErrorCode.CONSENT_REQUIRED);

        assertThat(memberRepositoryPort.findByEmail(EMAIL)).isEmpty();
    }

    @Test
    @DisplayName("문서 동의는 했지만 만 14세 확인이 없으면 동의 누락과 다른 코드로 거부한다")
    void rejectsNewMemberWithoutAgeConfirmationUsingItsOwnCode() {
        // MEMBER_010 으로 나가면 프론트는 이미 켜져 있는 동의 체크박스를 강조하게 되고,
        // 사용자는 "동의를 다 했는데 왜 안 되지"를 겪는다. 콜백은 인가코드를 이미 태운 뒤라
        // 돌아갈 곳이 동의 화면뿐이라서 사유가 정확해야 한다.
        assertThatThrownBy(() -> processor.login(PROVIDER, callback(new OAuthSignupConsent(true, true, false))))
            .isInstanceOf(MemberException.class)
            .hasFieldOrPropertyWithValue("errorCode", MemberErrorCode.AGE_REQUIREMENT_NOT_MET);

        assertThat(memberRepositoryPort.findByEmail(EMAIL)).isEmpty();
        assertThat(consentRepositoryPort.saved).isEmpty();
    }

    @Test
    @DisplayName("문서 동의와 만 14세 확인이 함께 비어 있으면 문서 동의 누락으로 거부한다")
    void reportsConsentFirstWhenEverythingIsMissing() {
        // 둘 다 비면 먼저 안내할 것은 문서 동의다 — #607 이 정한 이 경로의 기존 동작을 유지한다.
        assertThatThrownBy(() -> processor.login(PROVIDER, callback(OAuthSignupConsent.none())))
            .isInstanceOf(MemberException.class)
            .hasFieldOrPropertyWithValue("errorCode", MemberErrorCode.CONSENT_REQUIRED);
    }

    @Test
    @DisplayName("이미 가입한 회원은 동의 없이도 로그인된다 — 소급 동의를 요구하지 않는다")
    void existingMemberLogsInWithoutConsent() {
        Member existing = memberRepositoryPort.save(Member.builder()
            .id(1L).email(EMAIL).name("테스터").nickname("테스터")
            .role(SecurityRole.USER).provider(PROVIDER).status(MemberStatus.ACTIVE)
            .build());

        GeneralLoginInfo loginInfo = processor.login(PROVIDER, callback(OAuthSignupConsent.none()));

        assertThat(loginInfo.memberId()).isEqualTo(existing.id());
        // 동의는 수집·이용 시점에 받는 것이라, 로그인할 때마다 이력을 덧붙이지 않는다.
        assertThat(consentRepositoryPort.saved).isEmpty();
    }

    @Test
    @DisplayName("탈퇴한 이메일로 소셜 로그인하면 신규 가입되지 않고 MEMBER_ALREADY_WITHDRAWN 이 난다")
    void rejectsSocialLoginForWithdrawnEmail() {
        // #609 의 핵심 회귀 지점. 탈퇴 회원의 email 은 다이제스트로 치환돼 있어 원문 조회에
        // 잡히지 않는다 — 방어가 없으면 그대로 신규 생성 경로로 빠져 탈퇴자가 재가입된다.
        Member withdrawn = Member.builder()
            .id(1L).email(EMAIL).name("테스터").nickname("테스터")
            .role(SecurityRole.USER).provider(PROVIDER).status(MemberStatus.ACTIVE)
            .build()
            .withdraw(withdrawnEmailHasher.hash(EMAIL), LocalDateTime.now());
        memberRepositoryPort.save(withdrawn);

        assertThatThrownBy(() -> processor.login(PROVIDER, callback(new OAuthSignupConsent(true, true, true))))
            .isInstanceOf(MemberException.class)
            .hasFieldOrPropertyWithValue("errorCode", MemberErrorCode.MEMBER_ALREADY_WITHDRAWN);

        // 원문 이메일로는 아무 회원도 없어야 한다 — 새로 만들어졌다면 여기에 잡힌다.
        assertThat(memberRepositoryPort.findByEmail(EMAIL)).isEmpty();
        assertThat(consentRepositoryPort.saved).isEmpty();
    }

    @Test
    @DisplayName("탈퇴 회원 차단은 동의 검사보다 먼저다 — 동의를 안 했어도 탈퇴 사유로 거부한다")
    void reportsWithdrawnBeforeConsentForWithdrawnEmail() {
        // 원문을 보관하던 때는 상태 판정이 동의 흐름보다 앞이라 탈퇴자는 동의 여부와 무관하게
        // MEMBER_004 를 받았다. 그 응답을 그대로 유지한다.
        Member withdrawn = Member.builder()
            .id(1L).email(EMAIL).name("테스터").nickname("테스터")
            .role(SecurityRole.USER).provider(PROVIDER).status(MemberStatus.ACTIVE)
            .build()
            .withdraw(withdrawnEmailHasher.hash(EMAIL), LocalDateTime.now());
        memberRepositoryPort.save(withdrawn);

        assertThatThrownBy(() -> processor.login(PROVIDER, callback(OAuthSignupConsent.none())))
            .isInstanceOf(MemberException.class)
            .hasFieldOrPropertyWithValue("errorCode", MemberErrorCode.MEMBER_ALREADY_WITHDRAWN);
    }

    @Test
    @DisplayName("인가 시점에 받은 동의·확인이 state 에 실려 콜백까지 전달된다")
    void carriesConsentFromAuthorizeToCallback() {
        // 인가코드가 1회용이라 콜백에서 다시 받을 수 없다. 이 왕복이 끊기면
        // 최초 연동이 전부 MEMBER_010 또는 MEMBER_011 로 막힌다.
        processor.generateAuthorizationUrl(PROVIDER, new OAuthSignupConsent(true, true, true));

        OAuthStateQueryResult consumed = stateStorePort.consume(stateStorePort.lastState).orElseThrow();

        assertThat(consumed.provider()).isEqualTo(PROVIDER);
        assertThat(consumed.consent().agreedAll()).isTrue();
    }

    // --- fixtures ---

    /** 콜백에서 확보한 것 — provider 프로필은 고정이고, 테스트마다 다른 것은 동의뿐이다. */
    private OAuthCallbackInfo callback(OAuthSignupConsent consent) {
        return new OAuthCallbackInfo(oAuthMember(), consent);
    }

    private OAuthMemberQueryResult oAuthMember() {
        return OAuthMemberQueryResult.builder()
            .email(EMAIL).emailVerified(true).name("테스터").nickname("테스터").build();
    }

    /** 인가 URL 자체는 이 테스트의 관심사가 아니다 — state 가 무엇을 싣고 가는지만 본다. */
    private static class StubAuthorizationUrlProvider implements OAuthAuthorizationUrlProvider {

        @Override
        public OAuthProvider supports() {
            return PROVIDER;
        }

        @Override
        public String generateUrl(String state) {
            return "https://example.test/authorize?state=" + state;
        }
    }

    /** state 저장을 메모리로 흉내 낸다. consume 은 실제 구현과 같이 일회성이다. */
    private static class StubOAuthStateStorePort implements OAuthStateStorePort {

        private final Map<String, OAuthStateQueryResult> states = new HashMap<>();
        private String lastState;

        @Override
        public void save(String state, OAuthProvider provider, OAuthSignupConsent consent, Duration ttl) {
            states.put(state, new OAuthStateQueryResult(provider, consent));
            lastState = state;
        }

        @Override
        public Optional<OAuthStateQueryResult> consume(String state) {
            return Optional.ofNullable(states.remove(state));
        }
    }

    private static class RecordingConsentRepositoryPort implements MemberConsentRepositoryPort {

        private final List<MemberConsent> saved = new ArrayList<>();

        @Override
        public void saveAll(List<MemberConsent> consents) {
            saved.addAll(consents);
        }

        @Override
        public void deleteAllByMemberIdIn(List<Long> memberIds) {
            saved.removeIf(consent -> memberIds.contains(consent.memberId()));
        }
    }

    private static class StubMemberRepositoryPort implements MemberRepositoryPort {

        private final Map<Long, Member> members = new HashMap<>();

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
        public boolean existsByEmailIn(List<String> emails) {
            return emails.stream().anyMatch(email -> findByEmail(email).isPresent());
        }

        @Override
        public Optional<Member> findById(long memberId) {
            return Optional.ofNullable(members.get(memberId));
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
            memberIds.forEach(members::remove);
        }
    }

    /** 이 테스트는 메일 발송을 보지 않는다 — 계정 연결 통보는 별도 관심사다. */
    private static class NoOpMailSendPort implements MailSendPort {

        @Override
        public void sendVerificationCode(String email, String code) {
        }

        @Override
        public void sendAlreadyRegisteredNotice(String email) {
        }

        @Override
        public void sendPasswordResetCode(String email, String code) {
        }

        @Override
        public void sendPasswordResetNotRegisteredNotice(String email) {
        }

        @Override
        public void sendPasswordResetSocialOnlyNotice(String email, String providerName) {
        }

        @Override
        public void sendSocialLinkedNotice(String email, String providerName) {
        }

        @Override
        public void sendPasswordRemovedNotice(String email, String providerName) {
        }
    }
}
