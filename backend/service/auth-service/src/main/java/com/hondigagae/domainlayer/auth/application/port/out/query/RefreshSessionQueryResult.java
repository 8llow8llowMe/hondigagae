package com.hondigagae.domainlayer.auth.application.port.out.query;

import java.time.Instant;
import lombok.Builder;

/**
 * 활성 refresh 세션(로그인 기기) 한 건. lastRefreshedAt 은 세션 ZSET 의 score(마지막 갱신 시각)다.
 */
@Builder
public record RefreshSessionQueryResult(
    String sessionId,
    Instant lastRefreshedAt
) {

}
