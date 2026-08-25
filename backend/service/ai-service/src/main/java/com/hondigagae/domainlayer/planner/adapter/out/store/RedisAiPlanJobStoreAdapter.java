package com.hondigagae.domainlayer.planner.adapter.out.store;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanErrorCode;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanException;
import com.hondigagae.domainlayer.planner.application.port.out.AiPlanJobStorePort;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJob;
import com.hondigagae.global.properties.AiPlanJobProperties;
import com.hondigagae.redis.properties.RedisProperties;
import java.time.Duration;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Redis 기반 잡 저장소.
 * redis-core RedisTemplate의 기본 ObjectMapper는 java.time 직렬화를 지원하지 않으므로,
 * StringRedisTemplate + 서비스 ObjectMapper(JavaTimeModule 포함)로 JSON 문자열을 직접 다룬다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RedisAiPlanJobStoreAdapter implements AiPlanJobStorePort {

    private final StringRedisTemplate stringRedisTemplate;
    private final RedisProperties redisProperties;
    private final AiPlanJobProperties jobProperties;
    private final ObjectMapper objectMapper;

    @Override
    public Optional<AiPlanJob> findById(String jobId) {
        try {
            String json = stringRedisTemplate.opsForValue().get(buildJobKey(jobId));
            if (json == null) {
                return Optional.empty();
            }
            return Optional.of(objectMapper.readValue(json, AiPlanJob.class));
        } catch (JsonProcessingException exception) {
            log.warn("AI 일정 잡 데이터를 해석할 수 없어 없는 것으로 처리합니다. jobId={} reason={}", jobId, exception.getMessage());
            return Optional.empty();
        } catch (RedisConnectionFailureException exception) {
            throw new AiPlanException(AiPlanErrorCode.JOB_STORE_UNAVAILABLE, exception);
        }
    }

    @Override
    public Optional<String> reserveOrGetExistingJobId(Long memberId, String requestHash, String newJobId) {
        try {
            String key = buildIdempotencyKey(memberId, requestHash);
            Boolean reserved = stringRedisTemplate.opsForValue().setIfAbsent(
                key, newJobId, Duration.ofSeconds(jobProperties.ttlSeconds())
            );
            if (Boolean.TRUE.equals(reserved)) {
                return Optional.empty();
            }
            return Optional.ofNullable(stringRedisTemplate.opsForValue().get(key));
        } catch (RedisConnectionFailureException exception) {
            throw new AiPlanException(AiPlanErrorCode.JOB_STORE_UNAVAILABLE, exception);
        }
    }

    @Override
    public void releaseIdempotencyKey(Long memberId, String requestHash) {
        try {
            stringRedisTemplate.delete(buildIdempotencyKey(memberId, requestHash));
        } catch (RedisConnectionFailureException exception) {
            log.warn("AI 일정 중복 방지 키 해제를 건너뜁니다. memberId={} hash={} reason={}", memberId, requestHash, exception.getMessage());
        }
    }

    @Override
    public AiPlanJob save(AiPlanJob job) {
        try {
            stringRedisTemplate.opsForValue().set(
                buildJobKey(job.jobId()), objectMapper.writeValueAsString(job), Duration.ofSeconds(jobProperties.ttlSeconds())
            );
            return job;
        } catch (JsonProcessingException | RedisConnectionFailureException exception) {
            throw new AiPlanException(AiPlanErrorCode.JOB_STORE_UNAVAILABLE, exception);
        }
    }

    @Override
    public void deleteJob(String jobId) {
        try {
            stringRedisTemplate.delete(buildJobKey(jobId));
        } catch (RedisConnectionFailureException exception) {
            log.warn("AI 일정 잡 삭제를 건너뜁니다. jobId={} reason={}", jobId, exception.getMessage());
        }
    }

    private String buildJobKey(String jobId) {
        return "%s:aiplan:job:%s".formatted(redisProperties.normalizedKeyPrefix(), jobId);
    }

    private String buildIdempotencyKey(Long memberId, String requestHash) {
        return "%s:aiplan:job:idempotency:%d:%s".formatted(redisProperties.normalizedKeyPrefix(), memberId, requestHash);
    }
}
