package com.hondigagae.domainlayer.member.adapter.out.auth;

import com.hondigagae.domainlayer.auth.application.service.processor.JwtTokenProcessor;
import com.hondigagae.domainlayer.member.application.port.out.MemberSessionRevokePort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * member -> auth 컨텍스트 교차 의존을 이 어댑터 한 지점으로 한정한다.
 */
@Component
@RequiredArgsConstructor
public class MemberSessionRevokeAdapter implements MemberSessionRevokePort {

    private final JwtTokenProcessor jwtTokenProcessor;

    @Override
    public void revokeAllSessions(long memberId, String tokenId) {
        jwtTokenProcessor.revokeAllSessions(memberId, tokenId);
    }
}
