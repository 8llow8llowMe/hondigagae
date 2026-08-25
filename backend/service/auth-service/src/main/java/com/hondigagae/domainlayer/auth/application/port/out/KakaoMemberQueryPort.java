package com.hondigagae.domainlayer.auth.application.port.out;

import com.hondigagae.domainlayer.auth.application.port.out.query.OAuthMemberQueryResult;

public interface KakaoMemberQueryPort {

    OAuthMemberQueryResult fetchMember(String authCode);
}
