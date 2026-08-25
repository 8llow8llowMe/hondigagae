package com.hondigagae.domainlayer.auth.application.port.out;

import java.time.Duration;
import java.util.Optional;

public interface JwtTokenStorePort {

    void save(long memberId, String refreshToken);

    Optional<String> find(long memberId);

    void delete(long memberId);

    void saveAccessTokenIdBlacklist(String tokenId, Duration ttl);
}
