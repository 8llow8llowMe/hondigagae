package com.hondigagae.domainlayer.member.application.service.processor;

import com.hondigagae.domainlayer.member.application.exception.MemberErrorCode;
import com.hondigagae.domainlayer.member.application.exception.MemberException;
import com.hondigagae.domainlayer.member.application.info.MemberMyInfo;
import com.hondigagae.domainlayer.member.application.port.out.MemberRepositoryPort;
import com.hondigagae.domainlayer.member.domain.model.Member;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class MemberQueryProcessor {

    private final MemberRepositoryPort memberRepositoryPort;

    public MemberMyInfo getMyInfo(long memberId) {
        Member member = getActiveMember(memberId);
        return MemberMyInfo.from(member);
    }

    /**
     * 활성(ACTIVE) 회원만 통과시킨다. 탈퇴/정지 회원의 만료 전 토큰으로
     * 회원 스코프 API에 접근하는 것을 막기 위한 공통 검증이다.
     */
    public Member getActiveMember(long memberId) {
        Member member = memberRepositoryPort.findById(memberId)
            .orElseThrow(() -> new MemberException(MemberErrorCode.NOT_FOUND_MEMBER));

        switch (member.status()) {
            case WITHDRAWN -> throw new MemberException(MemberErrorCode.MEMBER_ALREADY_WITHDRAWN);
            case SUSPENDED -> throw new MemberException(MemberErrorCode.MEMBER_SUSPENDED);
            case ACTIVE -> {
            } // 정상
        }
        return member;
    }
}
