package com.hondigagae.domainlayer.auth.application.info;

import java.time.Duration;
import lombok.Builder;

/**
 * 인증코드 발송(회원가입 인증 · 비밀번호 재설정) 결과. 화면이 만료 · 재발송 타이머를 그릴 근거다 (#1293).
 *
 * <p><b>계정 열거 방지</b>: 이 값은 발송 프로세서의 상수(코드 TTL · 재발송 쿨다운)에서만 만든다.
 * 가입 여부에 따라 실제로 코드가 저장됐는지와 무관하다 — 기가입 · 미가입 · 탈퇴 · 소셜 전용 이메일이
 * 모두 같은 값을 받아야 응답으로 상태를 구분할 수 없다.
 */
@Builder
public record VerificationCodeSendInfo(
    Duration codeTtl,
    Duration resendCooldown
) {

    public static VerificationCodeSendInfo of(Duration codeTtl, Duration resendCooldown) {
        return VerificationCodeSendInfo.builder()
            .codeTtl(codeTtl)
            .resendCooldown(resendCooldown)
            .build();
    }
}
