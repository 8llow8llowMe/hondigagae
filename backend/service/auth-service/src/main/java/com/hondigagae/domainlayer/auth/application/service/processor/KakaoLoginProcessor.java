package com.hondigagae.domainlayer.auth.application.service.processor;

import com.hondigagae.domainlayer.auth.application.exception.AuthErrorCode;
import com.hondigagae.domainlayer.auth.application.exception.AuthException;
import com.hondigagae.domainlayer.auth.application.info.LoginInfo;
import com.hondigagae.domainlayer.auth.application.port.out.KakaoAuthorizationUrlPort;
import com.hondigagae.domainlayer.auth.application.port.out.KakaoMemberQueryPort;
import com.hondigagae.domainlayer.auth.application.port.out.OAuthStateStorePort;
import com.hondigagae.domainlayer.auth.application.port.out.query.OAuthMemberQueryResult;
import com.hondigagae.domainlayer.member.application.exception.MemberErrorCode;
import com.hondigagae.domainlayer.member.application.exception.MemberException;
import com.hondigagae.domainlayer.member.application.port.out.MemberRepositoryPort;
import com.hondigagae.domainlayer.member.domain.enums.MemberStatus;
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
public class KakaoLoginProcessor {

    private static final Duration STATE_TTL = Duration.ofMinutes(10);
    private static final int STATE_BYTE_LENGTH = 16;

    private final KakaoAuthorizationUrlPort kakaoAuthorizationUrlPort;
    private final KakaoMemberQueryPort kakaoMemberQueryPort;
    private final OAuthStateStorePort oAuthStateStorePort;
    private final MemberRepositoryPort memberRepositoryPort;
    private final SnowflakeIdGenerator snowflakeIdGenerator;
    private final SecureRandom secureRandom = new SecureRandom();

    /**
     * CSRF 방어용 일회성 state를 발급해 인가 URL에 포함시킨다.
     */
    public String generateAuthorizationUrl() {
        byte[] stateBytes = new byte[STATE_BYTE_LENGTH];
        secureRandom.nextBytes(stateBytes);
        String state = HexFormat.of().formatHex(stateBytes);

        oAuthStateStorePort.save(state, STATE_TTL);
        return kakaoAuthorizationUrlPort.generateUrl(state);
    }

    /**
     * 카카오 왕복(HTTP)만 담당한다. DB 트랜잭션 밖에서 호출해 커넥션 점유를 피한다.
     */
    public OAuthMemberQueryResult fetchKakaoMember(String authCode, String state) {
        // 1. state 검증(일회성 소비) — 우리가 발급한 요청인지 확인
        validateState(state);

        // 2. 카카오로부터 사용자 프로필 조회 및 필수 항목(부분 동의) 검증
        OAuthMemberQueryResult kakaoMember = kakaoMemberQueryPort.fetchMember(authCode);
        validateRequiredProfile(kakaoMember);

        return kakaoMember;
    }

    /**
     * 조회한 프로필로 회원을 조회/생성한다. 외부 HTTP를 포함하지 않는 이 구간만 트랜잭션 대상이다.
     */
    @Transactional
    public LoginInfo login(OAuthMemberQueryResult kakaoMember) {
        Member member = memberRepositoryPort.findByKakaoId(kakaoMember.kakaoId())
            .map(this::resolveExistingMember)
            .orElseGet(() -> createKakaoMember(kakaoMember));

        return LoginInfo.of(member.id(), member.role());
    }

    private void validateState(String state) {
        if (!StringUtils.hasText(state) || !oAuthStateStorePort.consume(state)) {
            throw new AuthException(AuthErrorCode.INVALID_OAUTH_STATE);
        }
    }

    private void validateRequiredProfile(OAuthMemberQueryResult kakaoMember) {
        // nickname은 회원 필수 컬럼이라 미동의 시 DB 제약 위반 대신 명확한 사유로 거부한다.
        if (!StringUtils.hasText(kakaoMember.nickname())) {
            throw new AuthException(AuthErrorCode.OAUTH_PROFILE_REQUIRED);
        }
    }

    private Member resolveExistingMember(Member existing) {
        // 탈퇴 회원은 소셜 로그인도 차단한다 (kakaoId가 유지되므로 재가입도 차단된다).
        if (existing.status() == MemberStatus.WITHDRAWN) {
            throw new MemberException(MemberErrorCode.MEMBER_ALREADY_WITHDRAWN);
        }
        return existing;
    }

    private Member createKakaoMember(OAuthMemberQueryResult kakaoMember) {
        Member newMember = Member.builder()
            .id(snowflakeIdGenerator.generateId())
            .kakaoId(kakaoMember.kakaoId())
            .email(kakaoMember.email())
            .nickname(kakaoMember.nickname())
            .profileImageUrl(kakaoMember.profileImageUrl())
            .role(SecurityRole.USER)
            .status(MemberStatus.ACTIVE)
            .build();

        log.info("[KakaoLoginProcessor] 카카오 신규 회원 가입: memberId={}", newMember.id());
        return memberRepositoryPort.save(newMember);
    }
}
