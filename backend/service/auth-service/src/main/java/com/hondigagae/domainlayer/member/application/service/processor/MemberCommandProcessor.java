package com.hondigagae.domainlayer.member.application.service.processor;

import com.hondigagae.domainlayer.member.application.port.out.MemberRepositoryPort;
import com.hondigagae.domainlayer.member.domain.model.Member;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class MemberCommandProcessor {

    private final MemberQueryProcessor memberQueryProcessor;
    private final MemberRepositoryPort memberRepositoryPort;

    /**
     * 논리 탈퇴 (상태 전이 + 개인정보 마스킹). kakaoId는 유지되어 재가입이 차단된다.
     */
    public void withdraw(long memberId) {
        Member member = memberQueryProcessor.getActiveMember(memberId);
        memberRepositoryPort.save(member.withdraw());
    }
}
