package com.hondigagae.domainlayer.auth.application.info;

import java.time.Duration;
import lombok.Builder;

/**
 * 인증코드 발송(회원가입 인증 · 비밀번호 재설정) 결과의 시간 정보 (#1293).
 *
 * <p><b>가입 여부와 무관한 고정값만 담는다.</b> 기가입 · 미가입 · 탈퇴 · 소셜 전용 이메일 모두 같은 값이어야
 * 응답으로 계정 상태를 구분할 수 없다 — 그래서 실제로 코드가 발급되지 않은 분기(안내 메일만 나간 경우)도
 * 코드 TTL 을 그대로 싣는다. 값이 분기마다 달라지는 순간 이 응답이 계정 열거 벡터가 된다.
 */
@Builder
public record VerificationCodeSendInfo(
    Duration codeExpiresIn,
    Duration resendAvailableIn
) {

    public static VerificationCodeSendInfo of(Duration codeExpiresIn, Duration resendAvailableIn) {
        return VerificationCodeSendInfo.builder()
            .codeExpiresIn(codeExpiresIn)
            .resendAvailableIn(resendAvailableIn)
            .build();
    }
}
