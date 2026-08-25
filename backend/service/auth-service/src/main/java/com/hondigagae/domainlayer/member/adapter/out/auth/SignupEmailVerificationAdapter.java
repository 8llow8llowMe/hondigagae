package com.hondigagae.domainlayer.member.adapter.out.auth;

import com.hondigagae.domainlayer.auth.application.port.out.EmailVerificationStorePort;
import com.hondigagae.domainlayer.auth.application.service.processor.EmailVerificationProcessor;
import com.hondigagae.domainlayer.member.application.port.out.SignupEmailVerificationPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * member -> auth 컨텍스트 교차 의존을 이 어댑터 한 지점으로 한정한다.
 * 이메일 정규화 규칙(trim + lowercase)을 auth 쪽과 동일하게 적용해 키 정합성을 보장한다.
 */
@Component
@RequiredArgsConstructor
public class SignupEmailVerificationAdapter implements SignupEmailVerificationPort {

    private final EmailVerificationStorePort emailVerificationStorePort;

    @Override
    public boolean isVerified(String email) {
        return emailVerificationStorePort.isVerified(EmailVerificationProcessor.normalize(email));
    }

    @Override
    public void consume(String email) {
        emailVerificationStorePort.deleteVerified(EmailVerificationProcessor.normalize(email));
    }
}
