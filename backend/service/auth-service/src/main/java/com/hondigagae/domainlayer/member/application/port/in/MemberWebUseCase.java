package com.hondigagae.domainlayer.member.application.port.in;

import com.hondigagae.domainlayer.member.adapter.in.web.dto.response.MemberMyInfoResponse;

public interface MemberWebUseCase {

    MemberMyInfoResponse getMyInfo(long memberId);

    void withdraw(long memberId, String tokenId);
}
