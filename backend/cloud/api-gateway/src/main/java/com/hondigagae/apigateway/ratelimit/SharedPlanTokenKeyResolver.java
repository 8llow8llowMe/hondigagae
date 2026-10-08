package com.hondigagae.apigateway.ratelimit;

import com.hondigagae.redis.properties.RedisProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.util.pattern.PathPattern;
import org.springframework.web.util.pattern.PathPattern.PathMatchInfo;
import org.springframework.web.util.pattern.PathPatternParser;
import reactor.core.publisher.Mono;

/**
 * 공유 링크 공개 경로({@code /api/v1/shared-plans/{token}})의 레이트 리밋 키 — <b>링크 단위</b>다 (#1244).
 *
 * <h2>왜 클라이언트 IP 가 아니라 토큰인가</h2>
 *
 * <p>공유 화면은 Next 서버 컴포넌트가 {@code BACKEND_API_URL} 로 API 를 부른다. 게이트웨이가 보는 클라이언트는
 * <b>늘 Next 서버 하나</b>다. IP 를 키로 쓰면 사이트 전체의 공유 트래픽이 버킷 하나를 나눠 써서, 봇 하나가 모든
 * 사용자의 공유 화면을 막는다. 막으려는 것은 증폭(공개 조회 1건 → plan-service → tour-service 최대 2회)이고, 그
 * 증폭은 <b>유효한 토큰</b>에서만 생기며 봇은 같은 링크를 되풀이해 두드린다. 그래서 링크 단위가 위협과 맞다.
 *
 * <h2>키는 셋 중 하나다</h2>
 *
 * <ul>
 *   <li><b>토큰 세그먼트가 없다</b> → 키 없음({@code Mono.empty()}). 필터가 판정 없이 통과시키고 plan-service 가 싼
 *       4xx 로 끝낸다</li>
 *   <li><b>발급할 수 있는 형식이다</b> → {@code {key-prefix}:shared-plan:{SHA-256(token) 앞 32 hex}}. 토큰은 그 자체가
 *       열람 권한이라 원문 대신 해시를 쓴다. 앞 32 hex(128비트)면 링크 수 규모에서 충돌은 없는 셈이다</li>
 *   <li><b>형식이 아니다</b> → 고정 키 {@code {key-prefix}:shared-plan:malformed}. 형식 위반 요청 <b>전부가 버킷 하나</b>를
 *       나눠 쓴다 — 무작위·변형 토큰 플러드가 토큰마다 Redis 키를 만들지 않는다</li>
 * </ul>
 *
 * <h2>같은 링크는 표기를 바꿔도 같은 버킷이다 — 근거 둘</h2>
 *
 * <p><b>하나, 해시하는 값은 Spring 이 경로 변수로 읽는 토큰이다</b>(퍼센트 디코딩, {@code ;매개변수} 제거). 게이트웨이
 * 라우트 술어와 plan-service 의 {@code @PathVariable} 이 그 값을 쓴다. 원문 세그먼트를 키로 쓰면 {@code %61bc} 처럼
 * 표기만 바꿔 버킷을 새로 받는데, plan-service 는 둘을 같은 토큰으로 읽는다.
 *
 * <p><b>둘, 형식 검사가 plan-service 와 같다.</b> 디코딩해도 남는 변형이 있다 — 뒤 공백({@code %20}). plan-service 의
 * 토큰 컬럼은 {@code utf8mb4_bin}(PAD SPACE)이라 {@code "T "} 가 {@code T} 행에 맞는다. 그래서 plan-service 는 발급
 * 형식이 아닌 토큰을 DB 를 보지 않고 404 로 끊고({@code PlanShareLinkProcessor#isWellFormedToken}), 이쪽은 그런 토큰을
 * malformed 버킷 하나로 모은다. 두 쪽이 같은 정규식이어야 "해시 버킷을 받는 표기 = 일정을 여는 표기" 가 된다.
 *
 * <h2>키 접두어는 키 <b>안</b>에 있지만 키 <b>앞머리</b>가 아니다</h2>
 *
 * <p>{@code RedisRateLimiter} 는 {@code infra.redis.key-prefix} 를 모르고 이 id 를 감싸
 * {@code request_rate_limiter.{<routeId>.<id>}.tokens|timestamp} 로 쓴다. 접두어를 id 에 실어 두면 dev Redis 를 함께 쓰는
 * 다른 프로젝트와 키가 겹치지 않지만, 실제 키는 {@code request_rate_limiter.} 로 시작한다 — <b>{@code SCAN <prefix>*}
 * 정리나 접두어 기반 ACL 에는 걸리지 않는다.</b> 키는 TTL(20초)로 스스로 사라진다.
 */
@Component
@RequiredArgsConstructor
public class SharedPlanTokenKeyResolver implements KeyResolver {

    /** {@code /**} 가 0개 이상의 하위 세그먼트를 받는다 — 뒤 슬래시·하위 경로도 같은 링크다. */
    private static final PathPattern SHARED_PLAN_PATH = new PathPatternParser().parse("/api/v1/shared-plans/{token}/**");
    private static final String TOKEN_VARIABLE = "token";

    /**
     * plan-service 가 발급하는 토큰의 형식 — {@code SecureRandom} 32바이트를 URL-safe Base64(패딩 없음)로 옮긴 43자다.
     * plan-service {@code PlanShareLinkProcessor} 의 {@code TOKEN_BYTES}·{@code TOKEN_ENCODER} 에서 나온 것과 같은 정규식이다.
     * 모듈 의존을 걸 수 없어 복사했다 — 저쪽이 바뀌면 여기도 바꾼다(어긋나면 정상 토큰이 malformed 버킷 하나로 몰린다).
     */
    private static final Pattern TOKEN_FORMAT = Pattern.compile("[A-Za-z0-9_-]{43}");

    private static final String KEY_SEGMENT = ":shared-plan:";
    private static final String MALFORMED_KEY_SUFFIX = "malformed";
    private static final int HASH_HEX_LENGTH = 32;

    private final RedisProperties redisProperties;

    @Override
    public Mono<String> resolve(ServerWebExchange exchange) {
        PathMatchInfo match = SHARED_PLAN_PATH.matchAndExtract(exchange.getRequest().getPath().pathWithinApplication());
        if (match == null) {
            return Mono.empty();
        }

        String token = match.getUriVariables().get(TOKEN_VARIABLE);
        String keyPrefix = redisProperties.normalizedKeyPrefix() + KEY_SEGMENT;
        if (token == null || !TOKEN_FORMAT.matcher(token).matches()) {
            return Mono.just(keyPrefix + MALFORMED_KEY_SUFFIX);
        }
        return Mono.just(keyPrefix + sha256Hex(token).substring(0, HASH_HEX_LENGTH));
    }

    private static String sha256Hex(String value) {
        try {
            // MessageDigest 는 스레드 안전하지 않다. 요청마다 새로 얻는다 — 비용은 무시할 수준이다.
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 은 모든 JVM 구현이 반드시 제공한다 (MessageDigest 명세).
            throw new IllegalStateException("SHA-256 을 쓸 수 없습니다", e);
        }
    }
}
