package com.hondigagae.domainlayer.member.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.member.application.exception.MemberErrorCode;
import com.hondigagae.domainlayer.member.application.exception.MemberException;
import com.hondigagae.domainlayer.member.application.port.out.MemberRepositoryPort;
import com.hondigagae.domainlayer.member.domain.enums.MemberStatus;
import com.hondigagae.domainlayer.member.domain.enums.OAuthProvider;
import com.hondigagae.domainlayer.member.domain.model.Member;
import com.hondigagae.security.common.enums.SecurityRole;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

class MemberCommandProcessorTest {

    private static final long GENERAL_ID = 1L;
    private static final long SOCIAL_ONLY_ID = 2L;
    private static final long LINKED_ID = 3L;

    private PasswordEncoder passwordEncoder;
    private StubMemberRepositoryPort memberRepositoryPort;
    private MemberCommandProcessor processor;

    @BeforeEach
    void setUp() {
        // bcrypt strength 4 — 실제 인코딩 로직을 그대로 쓰면서 테스트 시간만 줄인다.
        passwordEncoder = new BCryptPasswordEncoder(4);
        memberRepositoryPort = new StubMemberRepositoryPort();
        processor = new MemberCommandProcessor(
            new MemberQueryProcessor(memberRepositoryPort), memberRepositoryPort, passwordEncoder);

        memberRepositoryPort.register(member(GENERAL_ID, "general@example.com",
            passwordEncoder.encode("Password1!"), null));
        memberRepositoryPort.register(member(SOCIAL_ONLY_ID, "social@example.com", null, OAuthProvider.KAKAO));
        memberRepositoryPort.register(member(LINKED_ID, "linked@example.com",
            passwordEncoder.encode("Password1!"), OAuthProvider.KAKAO));
    }

    @Test
    void setupPassword_socialOnlyAccount_addsEmailLoginMethod() {
        processor.setupPassword(SOCIAL_ONLY_ID, "NewPassword2@");

        Member updated = memberRepositoryPort.findById(SOCIAL_ONLY_ID).orElseThrow();
        assertThat(passwordEncoder.matches("NewPassword2@", updated.password())).isTrue();
        // provider 는 유지된다 — 두 로그인 수단이 공존하는 연결 계정이 된다
        assertThat(updated.provider()).isEqualTo(OAuthProvider.KAKAO);
    }

    @Test
    void setupPassword_accountWithPassword_rejects() {
        assertThatThrownBy(() -> processor.setupPassword(LINKED_ID, "NewPassword2@"))
            .isInstanceOf(MemberException.class)
            .extracting(exception -> ((MemberException) exception).getErrorCode())
            .isEqualTo(MemberErrorCode.PASSWORD_ALREADY_SET);
    }

    @Test
    void removePassword_linkedAccount_convertsToSocialOnly() {
        Member converted = processor.removePassword(LINKED_ID);

        assertThat(converted.password()).isNull();
        assertThat(converted.provider()).isEqualTo(OAuthProvider.KAKAO);
        assertThat(memberRepositoryPort.findById(LINKED_ID).orElseThrow().password()).isNull();
    }

    @Test
    void removePassword_generalOnlyAccount_rejects() {
        // 소셜이 연결되지 않은 계정의 비밀번호를 지우면 로그인 수단이 사라진다
        assertThatThrownBy(() -> processor.removePassword(GENERAL_ID))
            .isInstanceOf(MemberException.class)
            .extracting(exception -> ((MemberException) exception).getErrorCode())
            .isEqualTo(MemberErrorCode.PASSWORD_REMOVAL_NOT_ALLOWED);
    }

    @Test
    void removePassword_socialOnlyAccount_rejects() {
        assertThatThrownBy(() -> processor.removePassword(SOCIAL_ONLY_ID))
            .isInstanceOf(MemberException.class)
            .extracting(exception -> ((MemberException) exception).getErrorCode())
            .isEqualTo(MemberErrorCode.SOCIAL_ACCOUNT_PASSWORD_UNSUPPORTED);
    }

    private Member member(long id, String email, String encodedPassword, OAuthProvider provider) {
        return Member.builder()
            .id(id).email(email).password(encodedPassword).nickname("tester")
            .role(SecurityRole.USER).provider(provider).status(MemberStatus.ACTIVE)
            .build();
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
        public boolean existsByEmail(String email) {
            return members.values().stream().anyMatch(member -> member.email().equals(email));
        }

        @Override
        public Optional<Member> findByEmail(String email) {
            return members.values().stream().filter(member -> member.email().equals(email)).findFirst();
        }

        @Override
        public Optional<Member> findById(long memberId) {
            return Optional.ofNullable(members.get(memberId));
        }
    }
}
