package com.hondigagae.domainlayer.insight.adapter.out.cache;

import com.hondigagae.domainlayer.insight.application.port.out.ForecastRefreshLockPort;
import com.hondigagae.redis.properties.RedisProperties;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Component;

/**
 * 예보 갱신 락 (Redis {@code SET NX PX}).
 *
 * <p><b>Redlock 을 쓰지 않는 이유:</b> dev/prod 는 Sentinel 3노드 구성인데, Sentinel 은 여러
 * 마스터에 분산하는 것이 아니라 마스터 하나를 감시하며 페일오버시키는 구조다. 쓰기는 항상 그
 * 마스터 한 곳으로 가므로 단순 {@code SET NX} 로 충분하다. Redlock 은 서로 독립된 마스터가
 * 여러 대일 때 필요한 알고리즘이다.
 *
 * <p>페일오버 중 락이 유실될 수는 있다(비동기 복제라 미복제 쓰기가 사라진다). 그래도 문제가
 * 없는 것은 <b>이 락이 정확성 장치가 아니라 절약 장치</b>이기 때문이다 - 유실되면 그 회차에
 * 기상청 호출이 한 번 더 나갈 뿐이고, 답이 틀리지는 않는다. 정확성이 걸린 락이라면 Redis 를
 * 쓰는 것 자체를 다시 생각해야 한다.
 *
 * <p>캐시 어댑터와 같은 원칙으로 <b>Redis 장애는 예외로 올리지 않는다.</b> 락을 못 잡은 것과
 * 같게 취급하고, 호출부가 락 없이 진행한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RedisForecastRefreshLockAdapter implements ForecastRefreshLockPort {

    private static final String KEY_FORMAT = "%s:insight:weather:lock:%s";

    /**
     * 토큰이 일치할 때만 지운다.
     *
     * <p>GET 후 DEL 로 나누면 그 사이에 TTL 이 만료되고 다른 요청이 키를 잡을 수 있어, 남의 락을
     * 지우게 된다. Lua 는 Redis 안에서 원자적으로 실행되므로 그 틈이 없다.
     */
    private static final RedisScript<Long> RELEASE_SCRIPT = new DefaultRedisScript<>(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        Long.class);

    private final StringRedisTemplate stringRedisTemplate;
    private final RedisProperties redisProperties;

    @Override
    public Optional<String> tryAcquire(String key, Duration ttl) {
        String token = UUID.randomUUID().toString();
        try {
            Boolean acquired = stringRedisTemplate.opsForValue()
                .setIfAbsent(buildKey(key), token, ttl);
            return Boolean.TRUE.equals(acquired) ? Optional.of(token) : Optional.empty();
        } catch (RedisConnectionFailureException exception) {
            log.warn("Forecast refresh lock skipped, redis unavailable key={}", key);
            return Optional.empty();
        } catch (Exception exception) {
            log.warn("Forecast refresh lock failed key={} reason={}", key, exception.getMessage());
            return Optional.empty();
        }
    }

    @Override
    public void release(String key, String token) {
        if (token == null) {
            return;
        }
        try {
            stringRedisTemplate.execute(RELEASE_SCRIPT, List.of(buildKey(key)), token);
        } catch (Exception exception) {
            // 해제에 실패해도 TTL 이 곧 풀어 준다. 여기서 예외를 올리면 정상적으로 받아온
            // 예보를 버리게 되므로 삼킨다.
            log.warn("Forecast refresh lock release failed key={} reason={}", key, exception.getMessage());
        }
    }

    private String buildKey(String key) {
        return String.format(KEY_FORMAT, redisProperties.normalizedKeyPrefix(), key);
    }
}
