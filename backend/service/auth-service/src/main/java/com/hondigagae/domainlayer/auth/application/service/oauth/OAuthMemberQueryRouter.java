package com.hondigagae.domainlayer.auth.application.service.oauth;

import com.hondigagae.domainlayer.auth.application.exception.AuthErrorCode;
import com.hondigagae.domainlayer.auth.application.exception.AuthException;
import com.hondigagae.domainlayer.auth.application.port.out.OAuthMemberQueryPort;
import com.hondigagae.domainlayer.auth.application.port.out.query.OAuthMemberQueryResult;
import com.hondigagae.domainlayer.member.domain.enums.OAuthProvider;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * provider별 사용자 정보 조회 구현을 supports() 키로 라우팅한다.
 */
@Component
public class OAuthMemberQueryRouter {

    private final Map<OAuthProvider, OAuthMemberQueryPort> portMap;

    public OAuthMemberQueryRouter(Set<OAuthMemberQueryPort> ports) {
        this.portMap = ports.stream()
            .collect(Collectors.toMap(OAuthMemberQueryPort::supports, Function.identity()));
    }

    public OAuthMemberQueryResult fetchMember(OAuthProvider provider, String authCode, String state) {
        return getPort(provider).fetchMember(authCode, state);
    }

    private OAuthMemberQueryPort getPort(OAuthProvider provider) {
        return Optional.ofNullable(portMap.get(provider))
            .orElseThrow(() -> new AuthException(AuthErrorCode.UNSUPPORTED_OAUTH_PROVIDER, provider.name()));
    }
}
