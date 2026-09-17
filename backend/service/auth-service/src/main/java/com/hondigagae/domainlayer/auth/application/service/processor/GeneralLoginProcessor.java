package com.hondigagae.domainlayer.auth.application.service.processor;

import com.hondigagae.domainlayer.auth.application.command.AuthGeneralLoginCommand;
import com.hondigagae.domainlayer.auth.application.exception.AuthErrorCode;
import com.hondigagae.domainlayer.auth.application.exception.AuthException;
import com.hondigagae.domainlayer.auth.application.info.GeneralLoginInfo;
import com.hondigagae.domainlayer.auth.application.port.out.LoginAttemptStorePort;
import com.hondigagae.domainlayer.member.application.exception.MemberErrorCode;
import com.hondigagae.domainlayer.member.application.exception.MemberException;
import com.hondigagae.domainlayer.member.application.port.out.MemberRepositoryPort;
import com.hondigagae.domainlayer.member.application.service.support.EmailNormalizer;
import com.hondigagae.domainlayer.member.domain.model.Member;
import com.hondigagae.global.properties.LoginAttemptProperties;
import java.util.Optional;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class GeneralLoginProcessor {

    private final MemberRepositoryPort memberRepositoryPort;
    private final PasswordEncoder passwordEncoder;
    private final LoginAttemptStorePort loginAttemptStorePort;
    private final LoginAttemptProperties loginAttemptProperties;
    // 미존재 이메일에도 bcrypt를 1회 수행해 응답 시간으로 계정 존재 여부가 드러나지 않게 한다.
    private final String timingEqualizerHash;

    public GeneralLoginProcessor(
        MemberRepositoryPort memberRepositoryPort,
        PasswordEncoder passwordEncoder,
        LoginAttemptStorePort loginAttemptStorePort,
        LoginAttemptProperties loginAttemptProperties
    ) {
        this.memberRepositoryPort = memberRepositoryPort;
        this.passwordEncoder = passwordEncoder;
        this.loginAttemptStorePort = loginAttemptStorePort;
        this.loginAttemptProperties = loginAttemptProperties;
        this.timingEqualizerHash = passwordEncoder.encode("timing-equalizer-placeholder");
    }

    /**
     * 일반 로그인. brute-force 방어(실패 카운터 + 잠금)는 <b>계정 존재 여부와 무관하게 이메일 키만으로</b>
     * 동작한다. 미존재 이메일도 실패로 카운팅되고 같은 임계값에서 같은 `AUTH_015` 로 잠기므로,
     * 잠금 응답이 "이 이메일은 가입돼 있다"는 신호가 되지 않는다. (기존 계정 열거 방지 설계 —
     * 미존재/비밀번호 불일치 통합 응답 + 더미 bcrypt 타이밍 균등화 — 를 잠금 경로까지 그대로 연장한 것)
     */
    public GeneralLoginInfo generalLogin(AuthGeneralLoginCommand command) {
        // Redis 키(case-sensitive)와 DB 저장값(정규화된 이메일) 정합을 위해 동일하게 정규화한다.
        String email = EmailNormalizer.normalize(command.email());

        // 1. 잠금 검사 — 회원 조회보다 먼저 수행해 잠긴 이메일에는 DB 조회/bcrypt 비용조차 주지 않는다.
        if (loginAttemptStorePort.isLocked(email)) {
            throw new AuthException(AuthErrorCode.LOGIN_ATTEMPT_LOCKED);
        }

        // 2. 회원 조회 (미존재도 LOGIN_FAILED로 응답해 계정 존재 여부를 노출하지 않는다)
        Optional<Member> memberHolder = memberRepositoryPort.findByEmail(email);
        if (memberHolder.isEmpty()) {
            passwordEncoder.matches(command.password(), timingEqualizerHash);
            throw registerFailure(email);
        }
        Member member = memberHolder.get();

        // 3. 비밀번호를 먼저 검증하고, 상태(탈퇴/정지)는 비밀번호가 맞을 때만 노출한다.
        if (!matchesPassword(command.password(), member.password())) {
            throw registerFailure(email);
        }
        validateMemberStatus(member);

        // 4. 성공 시 실패 카운터/잠금 초기화 후 로그인 정보 반환
        loginAttemptStorePort.clearFailures(email);
        return GeneralLoginInfo.of(member.id(), member.role());
    }

    /**
     * 실패 카운터를 올리고 던질 예외를 결정한다. 임계값에 도달하면 잠금을 걸고 `AUTH_015`,
     * 그 전까지는 기존과 동일한 `AUTH_006` 을 반환한다.
     *
     * <p>저장소 장애 시 카운터가 0 을 반환하면(fail-open) 잠금 없이 `AUTH_006` 으로만 응답한다 —
     * 카운터 저장소 장애로 로그인 전체를 막지 않는다.
     */
    private AuthException registerFailure(String email) {
        long failureCount = loginAttemptStorePort.increaseFailureCount(email, loginAttemptProperties.lockDuration());
        if (failureCount >= loginAttemptProperties.maxFailureCount()) {
            loginAttemptStorePort.lock(email, loginAttemptProperties.lockDuration());
            return new AuthException(AuthErrorCode.LOGIN_ATTEMPT_LOCKED);
        }
        return new AuthException(AuthErrorCode.LOGIN_FAILED);
    }

    private void validateMemberStatus(Member member) {
        switch (member.status()) {
            case WITHDRAWN -> throw new MemberException(MemberErrorCode.MEMBER_ALREADY_WITHDRAWN);
            case SUSPENDED -> throw new MemberException(MemberErrorCode.MEMBER_SUSPENDED);
            case ACTIVE -> {
            } // 정상
        }
    }

    private boolean matchesPassword(String rawPassword, String encodedPassword) {
        // 소셜 확장 대비 password nullable — 비밀번호가 없는 계정도 동일하게 LOGIN_FAILED로 응답한다.
        return encodedPassword != null && passwordEncoder.matches(rawPassword, encodedPassword);
    }
}
