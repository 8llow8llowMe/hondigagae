package com.hondigagae.redis.properties;

import com.hondigagae.redis.properties.enums.RedisMode;
import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "infra.redis")
public record RedisProperties(
    RedisMode mode,
    String host,
    Integer port,
    String masterName,
    String password,
    // yml 에 직접 적을 때 쓰는 형태. 로컬에서 노드를 명시할 때만 쓴다.
    List<SentinelNode> sentinels,
    /**
     * 환경변수/Vault 로 넘기는 형태. {@code host:port,host:port,host:port} 콤마 구분이다.
     *
     * <p>목록형 프로퍼티를 env 로 넘기려면 인덱스별 키를 나열해야 하는데({@code ..._0_HOST}),
     * Vault 와 compose 에서 다루기 번거롭고 노드 수가 바뀔 때 빠뜨리기 쉽다.
     * 문자열 하나로 받으면 노드 수와 무관하게 한 값만 관리한다.
     */
    String sentinelNodes,
    String keyPrefix,
    /**
     * Redis 명령 하나를 기다리는 상한 ({@code infra.redis.command-timeout}, 예: {@code 1s}). 선택값이다 (#1253).
     *
     * <p>비우면 Lettuce 기본을 그대로 쓴다 — 동기 호출은 60초, 리액티브·비동기 명령은 상한이 없다.
     * Redis 가 연결을 거부하면 바로 실패하지만 <b>먹통(패킷 드롭 · 응답 없음)이면 그만큼 기다린다.</b>
     * 실패를 빨리 봐야 하는 곳(게이트웨이의 레이트 리밋 fail-open · 블랙리스트 판정)만 짧게 적는다.
     */
    Duration commandTimeout,
    /**
     * TCP 연결을 맺는 상한 ({@code infra.redis.connect-timeout}, 예: {@code 2s}). 선택값이다 (#1253).
     *
     * <p>비우면 Lettuce 기본(10초). 공유 연결을 처음 맺을 때 이 시간만큼 호출 스레드가 묶인다.
     */
    Duration connectTimeout
) {

    private static final String DEFAULT_KEY_PREFIX = "hondigagae";
    private static final int DEFAULT_SENTINEL_PORT = 26379;

    /**
     * 명령·연결 타임아웃 중 하나라도 적었는지.
     *
     * <p>둘 다 비었으면 연결 팩토리를 예전과 똑같이(클라이언트 설정 없이) 만든다 — 값을 적지 않은 서비스는
     * 이 설정이 생기기 전과 다르지 않게 동작해야 한다.
     */
    public boolean hasClientTimeouts() {
        return commandTimeout != null || connectTimeout != null;
    }

    public String normalizedKeyPrefix() {
        if (keyPrefix == null || keyPrefix.isBlank()) {
            return DEFAULT_KEY_PREFIX;
        }
        return keyPrefix.trim();
    }

    /**
     * 실제로 접속할 Sentinel 노드 목록.
     *
     * <p>{@code sentinelNodes} 문자열이 있으면 그것을 쓰고, 없으면 yml 목록을 쓴다.
     * 환경변수가 우선인 이유는 dev/prod 가 그 경로로만 설정되기 때문이다 - yml 목록은
     * 로컬에서 손으로 적을 때의 탈출구다.
     */
    public List<SentinelNode> resolvedSentinels() {
        if (sentinelNodes != null && !sentinelNodes.isBlank()) {
            return parseNodes(sentinelNodes);
        }
        return sentinels == null ? List.of() : sentinels;
    }

    /**
     * {@code host:port} 목록을 파싱한다. 포트를 생략하면 Sentinel 기본 포트를 쓴다.
     *
     * <p>형식이 깨진 항목은 <b>조용히 버리지 않고</b> 예외로 올린다. Sentinel 노드 하나가
     * 조용히 빠지면 평소에는 잘 돌다가 페일오버 때만 못 따라가는데, 그때가 되어서야 드러난다.
     */
    private static List<SentinelNode> parseNodes(String raw) {
        return Arrays.stream(raw.split(","))
            .map(String::trim)
            .filter(entry -> !entry.isEmpty())
            .map(RedisProperties::parseNode)
            .toList();
    }

    private static SentinelNode parseNode(String entry) {
        int separator = entry.lastIndexOf(':');
        if (separator < 0) {
            return new SentinelNode(entry, DEFAULT_SENTINEL_PORT);
        }
        String host = entry.substring(0, separator).trim();
        String port = entry.substring(separator + 1).trim();
        if (host.isEmpty()) {
            throw new IllegalStateException(
                "infra.redis.sentinel-nodes 항목에 호스트가 없습니다: " + entry);
        }
        try {
            return new SentinelNode(host, Integer.parseInt(port));
        } catch (NumberFormatException exception) {
            throw new IllegalStateException(
                "infra.redis.sentinel-nodes 의 포트를 읽을 수 없습니다: " + entry, exception);
        }
    }

    public record SentinelNode(
        String host,
        int port
    ) {

    }
}
