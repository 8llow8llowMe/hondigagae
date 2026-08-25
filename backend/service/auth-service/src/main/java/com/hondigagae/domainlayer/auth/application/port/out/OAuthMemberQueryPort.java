package com.hondigagae.domainlayer.auth.application.port.out;

import com.hondigagae.domainlayer.auth.application.port.out.query.OAuthMemberQueryResult;
import com.hondigagae.domainlayer.member.domain.enums.OAuthProvider;

public interface OAuthMemberQueryPort {

    OAuthProvider supports();

    OAuthMemberQueryResult fetchMember(String authCode, String state);
}
