package com.hondigagae.domainlayer.auth.adapter.out.persistence;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.domainlayer.auth.application.model.OAuthSignupConsent;
import com.hondigagae.domainlayer.auth.application.port.out.OAuthStateStorePort;
import com.hondigagae.domainlayer.auth.application.port.out.query.OAuthStateQueryResult;
import com.hondigagae.domainlayer.member.domain.enums.OAuthProvider;
import com.hondigagae.redis.properties.RedisProperties;
import java.time.Duration;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class RedisOAuthStateStoreAdapter implements OAuthStateStorePort {

    private final RedisTemplate<String, String> redisTemplate;
    private final RedisProperties redisProperties;
    private final ObjectMapper objectMapper;

    /**
     * 보관할 값이 여러 개가 됐지만 <b>Redis Hash 를 쓰지 않는다.</b> state 의 일회성은 GETDEL 의
     * 원자성에 기대고 있는데 GETDEL 은 Hash 에 먹지 않는다 — HGETALL + DEL 로 나누면 그 사이에
     * 같은 state 를 두 번 소비할 수 있다. 그래서 JSON 한 덩어리로 직렬화해 단일 String 에 넣는다.
     */
    @Override
    public void save(String state, OAuthProvider provider, OAuthSignupConsent consent, Duration ttl) {
        redisTemplate.opsForValue().set(buildKey(state), serialize(provider, consent), ttl);
    }

    @Override
    public Optional<OAuthStateQueryResult> consume(String state) {
        // GETDEL(Redis 6.2+)로 조회와 삭제를 원자적으로 수행해 state 재사용을 차단한다.
        String payload = redisTemplate.opsForValue().getAndDelete(buildKey(state));
        if (payload == null) {
            return Optional.empty();
        }

        return deserialize(payload);
    }

    private String serialize(OAuthProvider provider, OAuthSignupConsent consent) {
        try {
            return objectMapper.writeValueAsString(
                new StatePayload(provider.name(), consent.termsAgreed(), consent.privacyAgreed()));
        } catch (JsonProcessingException e) {
            // 필드가 provider 이름과 boolean 둘뿐이라 실무상 발생하지 않는다. 그래도 삼키면
            // state 없는 인가 URL 이 나가 콜백이 전부 실패하므로, 여기서 끊어 원인을 남긴다.
            throw new IllegalStateException("OAuth state 직렬화에 실패했습니다.", e);
        }
    }

    private Optional<OAuthStateQueryResult> deserialize(String payload) {
        try {
            StatePayload statePayload = objectMapper.readValue(payload, StatePayload.class);
            return Optional.of(new OAuthStateQueryResult(
                OAuthProvider.valueOf(statePayload.provider()),
                new OAuthSignupConsent(statePayload.termsAgreed(), statePayload.privacyAgreed())));
        } catch (JsonProcessingException | IllegalArgumentException e) {
            // 두 경우가 여기로 떨어진다 — enum 상수명을 바꾼 배포와 기존 state 의 TTL 이 겹칠 때,
            // 그리고 이 JSON 형식을 넣기 전 구버전이 저장한 맨 문자열("KAKAO") state 일 때.
            // 둘 다 무효 state 로 처리하면 사용자는 인가부터 다시 밟는다. state TTL 이 10분이라
            // 배포 직후 10분이면 사라지는 과도기 현상이다.
            log.warn("[RedisOAuthStateStoreAdapter] 해석할 수 없는 state 값: value={}", payload);
            return Optional.empty();
        }
    }

    private String buildKey(String state) {
        return redisProperties.normalizedKeyPrefix() + ":auth:oauthState:" + state;
    }

    /**
     * Redis 에 넣는 직렬화 형태. adapter 안에만 존재해야 하는 표현이라 application 으로 내보내지
     * 않는다 — 밖으로 나가는 것은 {@link OAuthStateQueryResult} 뿐이다.
     */
    private record StatePayload(String provider, boolean termsAgreed, boolean privacyAgreed) {

    }
}
