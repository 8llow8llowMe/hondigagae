package com.hondigagae.domainlayer.auth.application.port.out;

import com.hondigagae.domainlayer.member.domain.enums.OAuthProvider;
import java.time.Duration;
import java.util.Optional;

/**
 * OAuth 인가 요청의 state(CSRF 방어 일회성 토큰) 저장 계약.
 * state에 provider를 함께 저장해 콜백의 provider 바꿔치기까지 차단한다.
 */
public interface OAuthStateStorePort {

    void save(String state, OAuthProvider provider, Duration ttl);

    /**
     * state를 원자적으로 조회+삭제한다(일회성 보장).
     *
     * @return 저장 시점의 provider. state가 없거나 만료되었으면 empty
     */
    Optional<OAuthProvider> consume(String state);
}
