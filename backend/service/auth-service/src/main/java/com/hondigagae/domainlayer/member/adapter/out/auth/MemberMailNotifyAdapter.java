package com.hondigagae.domainlayer.member.adapter.out.auth;

import com.hondigagae.domainlayer.auth.application.port.out.MailSendPort;
import com.hondigagae.domainlayer.member.application.port.out.MemberMailNotifyPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * member -> auth 컨텍스트 교차 의존을 이 어댑터 한 지점으로 한정한다.
 */
@Component
@RequiredArgsConstructor
public class MemberMailNotifyAdapter implements MemberMailNotifyPort {

    private final MailSendPort mailSendPort;

    @Override
    public void notifyPasswordRemoved(String email, String providerName) {
        mailSendPort.sendPasswordRemovedNotice(email, providerName);
    }
}
