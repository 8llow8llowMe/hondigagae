package com.hondigagae.domainlayer.member.adapter.out.auth;

import com.hondigagae.domainlayer.auth.application.port.out.EmailVerificationStorePort;
import com.hondigagae.domainlayer.member.application.port.out.SignupEmailVerificationPort;
import com.hondigagae.domainlayer.member.application.service.support.EmailNormalizer;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * member -> auth 컨텍스트 교차 의존을 이 어댑터 한 지점으로 한정한다.
 * 이메일 정규화는 {@link EmailNormalizer} 하나만 써서 auth 쪽 키와 정합을 보장한다.
 */
@Component
@RequiredArgsConstructor
public class SignupEmailVerificationAdapter implements SignupEmailVerificationPort {

    private final EmailVerificationStorePort emailVerificationStorePort;

    @Override
    public boolean isVerified(String email) {
        return emailVerificationStorePort.isVerified(EmailNormalizer.normalize(email));
    }

    @Override
    public void consume(String email) {
        emailVerificationStorePort.deleteVerified(EmailNormalizer.normalize(email));
    }
}
