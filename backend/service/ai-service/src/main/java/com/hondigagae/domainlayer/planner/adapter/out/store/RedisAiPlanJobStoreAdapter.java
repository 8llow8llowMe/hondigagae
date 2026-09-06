package com.hondigagae.domainlayer.planner.adapter.out.store;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanErrorCode;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanException;
import com.hondigagae.domainlayer.planner.application.port.out.AiPlanJobStorePort;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJob;
import com.hondigagae.domainlayer.planner.domain.model.AiPlanJobStatus;
import com.hondigagae.global.properties.AiPlanJobProperties;
import com.hondigagae.redis.properties.RedisProperties;
import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
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

    /**
     * 종결 상태를 덮지 않는 저장. 취소·타임아웃과 워커 진행은 서로 다른 스레드의
     * read-modify-write 라, 단순 SET 이면 CANCELED/FAILED 직후 워커의 낡은 스냅샷이
     * RUNNING/COMPLETED 로 잡을 되살린다. 저장 지점에서 원자적으로 막는 것이 유일한 방어다.
     * 종결 상태 목록(ARGV[3..])은 {@link AiPlanJobStatus#isTerminal()} 에서 만든다.
     */
    private static final DefaultRedisScript<String> SAVE_UNLESS_TERMINAL_SCRIPT = new DefaultRedisScript<>("""
        local current = redis.call('GET', KEYS[1])
        if current then
          local ok, decoded = pcall(cjson.decode, current)
          if ok and type(decoded) == 'table' and decoded['status'] then
            for i = 3, #ARGV do
              if decoded['status'] == ARGV[i] then
                return current
              end
            end
          end
        end
        redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
        return ARGV[1]
        """, String.class);

    /**
     * 값(jobId)이 일치할 때만 지우는 compare-and-delete. 무조건 DEL 이면 취소→재제출 뒤
     * 옛 워커의 finally 가 <b>새 잡의 키</b>를 지워 동일 요청의 중복 실행이 열린다.
     */
    private static final DefaultRedisScript<Long> DELETE_IF_VALUE_MATCHES_SCRIPT = new DefaultRedisScript<>("""
        if redis.call('GET', KEYS[1]) == ARGV[1] then
          return redis.call('DEL', KEYS[1])
        end
        return 0
        """, Long.class);

    private static final List<String> TERMINAL_STATUS_NAMES = Arrays.stream(AiPlanJobStatus.values())
        .filter(AiPlanJobStatus::isTerminal)
        .map(Enum::name)
        .toList();

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
            Optional<String> firstTry = tryReserve(key, newJobId);
            if (firstTry != null) {
                return firstTry;
            }
            // setIfAbsent 실패와 GET 사이에 키가 만료·해제된 좁은 창이다. 한 번 더 선점을 시도하고,
            // 그래도 판정이 안 되면 "예약 성공" 으로 오판하지 않는다 — 키 없이 진행하면 그 순간부터
            // 동일 요청의 중복 제출이 막히지 않는다.
            Optional<String> secondTry = tryReserve(key, newJobId);
            if (secondTry != null) {
                return secondTry;
            }
            throw new AiPlanException(AiPlanErrorCode.JOB_STORE_UNAVAILABLE);
        } catch (RedisConnectionFailureException exception) {
            throw new AiPlanException(AiPlanErrorCode.JOB_STORE_UNAVAILABLE, exception);
        }
    }

    /** 선점 성공이면 empty, 기존 잡이 있으면 그 jobId. 판정 불가(키가 사이에 사라짐)면 null. */
    private Optional<String> tryReserve(String key, String newJobId) {
        Boolean reserved = stringRedisTemplate.opsForValue().setIfAbsent(
            key, newJobId, Duration.ofSeconds(jobProperties.ttlSeconds())
        );
        if (Boolean.TRUE.equals(reserved)) {
            return Optional.empty();
        }
        String existing = stringRedisTemplate.opsForValue().get(key);
        return existing == null ? null : Optional.of(existing);
    }

    @Override
    public void releaseIdempotencyKey(Long memberId, String requestHash, String jobId) {
        try {
            stringRedisTemplate.execute(
                DELETE_IF_VALUE_MATCHES_SCRIPT, List.of(buildIdempotencyKey(memberId, requestHash)), jobId
            );
        } catch (RedisConnectionFailureException exception) {
            log.warn("AI 일정 중복 방지 키 해제를 건너뜁니다. memberId={} hash={} reason={}", memberId, requestHash, exception.getMessage());
        }
    }

    @Override
    public AiPlanJob save(AiPlanJob job) {
        try {
            Object[] args = new Object[2 + TERMINAL_STATUS_NAMES.size()];
            args[0] = objectMapper.writeValueAsString(job);
            args[1] = String.valueOf(jobProperties.ttlSeconds());
            for (int i = 0; i < TERMINAL_STATUS_NAMES.size(); i++) {
                args[2 + i] = TERMINAL_STATUS_NAMES.get(i);
            }
            String winner = stringRedisTemplate.execute(SAVE_UNLESS_TERMINAL_SCRIPT, List.of(buildJobKey(job.jobId())), args);
            if (winner == null || winner.equals(args[0])) {
                return job;
            }
            return objectMapper.readValue(winner, AiPlanJob.class);
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
