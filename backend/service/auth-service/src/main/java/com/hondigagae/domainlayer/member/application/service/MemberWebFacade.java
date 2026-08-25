package com.hondigagae.domainlayer.member.application.service;

import com.hondigagae.domainlayer.member.adapter.in.web.dto.response.MemberMyInfoResponse;
import com.hondigagae.domainlayer.member.adapter.in.web.presenter.MemberPresenter;
import com.hondigagae.domainlayer.member.application.info.MemberMyInfo;
import com.hondigagae.domainlayer.member.application.port.in.MemberWebUseCase;
import com.hondigagae.domainlayer.member.application.port.out.MemberSessionRevokePort;
import com.hondigagae.domainlayer.member.application.service.processor.MemberCommandProcessor;
import com.hondigagae.domainlayer.member.application.service.processor.MemberQueryProcessor;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MemberWebFacade implements MemberWebUseCase {

    private final MemberQueryProcessor memberQueryProcessor;
    private final MemberCommandProcessor memberCommandProcessor;
    private final MemberSessionRevokePort memberSessionRevokePort;
    private final MemberPresenter memberPresenter;

    @Override
    @Transactional(readOnly = true)
    public MemberMyInfoResponse getMyInfo(long memberId) {
        MemberMyInfo memberMyInfo = memberQueryProcessor.getMyInfo(memberId);
        return memberPresenter.toMyInfoResponse(memberMyInfo);
    }

    @Override
    @Transactional
    public void withdraw(long memberId, String tokenId) {
        // 1. 논리 탈퇴 (상태 전이 + 개인정보 마스킹)
        memberCommandProcessor.withdraw(memberId);

        // 2. 세션 무효화 — 실패 시 탈퇴도 함께 롤백된다.
        memberSessionRevokePort.revokeAllSessions(memberId, tokenId);
    }
}
