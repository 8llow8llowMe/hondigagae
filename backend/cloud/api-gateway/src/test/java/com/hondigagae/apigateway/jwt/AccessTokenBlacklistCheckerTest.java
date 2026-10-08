package com.hondigagae.apigateway.jwt;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.hondigagae.apigateway.jwt.exception.JwtErrorCode;
import com.hondigagae.apigateway.jwt.exception.JwtException;
import com.hondigagae.apigateway.jwt.properties.JwtVerificationProperties;
import com.hondigagae.redis.properties.RedisProperties;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.RedisSystemException;
import org.springframework.data.redis.core.RedisTemplate;

/**
 * 블랙리스트 판정이 Redis 를 읽지 못할 때의 규칙을 고정한다 (#1253).
 *
 * <p>읽지 못하는 대표 모양은 셋이다 — <b>연결 실패</b>({@link RedisConnectionFailureException}, 거부 · 연결 타임아웃),
 * <b>명령 타임아웃</b>({@link QueryTimeoutException}, 연결은 됐는데 답이 없음), <b>Redis 오류 응답</b>
 * ({@link RedisSystemException}). 셋은 Spring 예외 계층이 갈라져 있어서 전에는 연결 실패만 잡았고, 나머지는 그대로
 * 새어 <b>500</b> 이 됐다. 그래서 auth-service 와 같이 {@link DataAccessException} 전체를 잡는다. 어느 쪽이든 "확인하지 못했다" 는
 * 같은 사실이므로 같은 규칙을 따른다 — 기본은 fail-closed(503 SECURITY_008), {@code jwt.blacklist-fail-open} 이면 통과.
 * 실제 호출에서 명령 타임아웃이 {@link QueryTimeoutException} 으로 나오는 것은 redis-core 의
 * {@code RedisCommandTimeoutBehaviorTest} 가 가짜 Redis 로 고정한다.
 */
class AccessTokenBlacklistCheckerTest {

    private static final String TOKEN_ID = "token-id";
    private static final String KEY = "hondigagae:test:auth:accessTokenBlacklist:" + TOKEN_ID;

    private final RedisTemplate<String, Object> redisTemplate = mock();

    static Stream<Arguments> unreachableRedis() {
        return Stream.of(
            Arguments.of("연결 실패", new RedisConnectionFailureException("Redis connection failed")),
            Arguments.of("명령 타임아웃", new QueryTimeoutException("Redis command timed out")),
            // Redis 가 오류로 답하는 경우(LOADING · READONLY · NOAUTH 등) — auth-service 처럼 DataAccessException 전체를 잡는다
            Arguments.of("Redis 오류 응답", new RedisSystemException("LOADING Redis is loading the dataset in memory", null)));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("unreachableRedis")
    @DisplayName("Redis 를 읽지 못하면 fail-closed 로 503 SECURITY_008 이다 — 명령 타임아웃도 연결 실패와 같다")
    void failsClosedWhenRedisIsUnreachable(String reason, DataAccessException failure) {
        when(redisTemplate.hasKey(KEY)).thenThrow(failure);

        assertThatThrownBy(() -> checker(false).isBlacklisted(TOKEN_ID))
            .isInstanceOfSatisfying(JwtException.class,
                exception -> assertThat(exception.getErrorCode()).isEqualTo(JwtErrorCode.TOKEN_VERIFICATION_UNAVAILABLE));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("unreachableRedis")
    @DisplayName("fail-open 이면 Redis 를 읽지 못해도 통과시킨다 — 명령 타임아웃도 연결 실패와 같다")
    void failsOpenWhenConfigured(String reason, DataAccessException failure) {
        when(redisTemplate.hasKey(KEY)).thenThrow(failure);

        assertThat(checker(true).isBlacklisted(TOKEN_ID)).isFalse();
    }

    @Test
    @DisplayName("블랙리스트 키가 있으면 차단 대상이다 — 키는 auth-service 가 쓰는 것과 같은 모양이다")
    void blacklistedWhenKeyExists() {
        when(redisTemplate.hasKey(KEY)).thenReturn(true);

        assertThat(checker(false).isBlacklisted(TOKEN_ID)).isTrue();
    }

    private AccessTokenBlacklistChecker checker(boolean failOpen) {
        RedisProperties redisProperties =
            new RedisProperties(null, null, null, null, null, null, null, "hondigagae:test", null, null);
        return new AccessTokenBlacklistChecker(redisTemplate, new JwtVerificationProperties("unused", failOpen), redisProperties);
    }
}
