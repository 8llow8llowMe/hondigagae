package com.hondigagae.domainlayer.auth.application.service.support;

import java.security.SecureRandom;
import org.springframework.stereotype.Component;

/**
 * 이메일로 발송하는 인증코드 생성기. 회원가입 인증과 비밀번호 재설정이 같은 규칙을 쓴다.
 * 육안 혼동을 줄이기 위해 I/O/0/1 을 제외한 대문자+숫자 8자를 만든다.
 */
@Component
public class VerificationCodeGenerator {

    private static final int CODE_LENGTH = 8;
    private static final String CODE_CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private final SecureRandom secureRandom = new SecureRandom();

    public String generate() {
        StringBuilder builder = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            builder.append(CODE_CHARACTERS.charAt(secureRandom.nextInt(CODE_CHARACTERS.length())));
        }
        return builder.toString();
    }
}
