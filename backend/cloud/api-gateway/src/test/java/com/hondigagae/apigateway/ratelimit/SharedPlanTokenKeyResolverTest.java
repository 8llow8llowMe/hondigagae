package com.hondigagae.apigateway.ratelimit;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.redis.properties.RedisProperties;
import java.net.URI;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpMethod;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;

/**
 * 공유 링크 레이트 리밋의 키가 <b>링크 단위</b>이고, 토큰 원문을 담지 않는지 고정한다 (#1244).
 *
 * <p>고정하는 것은 넷이다.
 * <ul>
 *   <li><b>같은 링크는 같은 버킷</b> — 쿼리스트링·뒤 슬래시·하위 경로·퍼센트 인코딩·{@code ;매개변수} 는 디코딩한 토큰이
 *       같아 같은 키다. plan-service 도 같은 디코딩으로 같은 토큰을 읽는다</li>
 *   <li><b>발급 형식이 아닌 토큰은 버킷 하나</b> — 뒤 공백({@code %20})처럼 디코딩해도 남는 변형은 형식 검사로 걸러
 *       고정 키 하나에 모은다. plan-service 가 같은 정규식으로 그 표기를 DB 조회 없이 404 로 끊으므로, 해시 버킷을
 *       받는 표기와 일정을 여는 표기가 일치한다. 변형마다 키가 갈리면 PAD SPACE 콜레이션 탓에 같은 일정을 한도
 *       없이 열 수 있었다</li>
 *   <li><b>원문이 키에 없다</b> — 토큰은 그 자체가 열람 권한이다</li>
 *   <li><b>토큰 세그먼트가 없으면 키가 없다</b> — 필터가 이것을 "통과" 로 읽는다</li>
 * </ul>
 */
class SharedPlanTokenKeyResolverTest {

    private static final String KEY_PREFIX = "hondigagae:test";
    private static final String MALFORMED_KEY = KEY_PREFIX + ":shared-plan:malformed";

    /** 발급 형식(32바이트 URL-safe Base64 무패딩, 43자)의 토큰 둘. */
    private static final String TOKEN = "aG9uZGlnYWdhZS1zaGFyZWQtcGxhbi10b2tlbi0jMDE";
    private static final String OTHER_TOKEN = "aG9uZGlnYWdhZS1zaGFyZWQtcGxhbi10b2tlbi0jMDI";

    private final SharedPlanTokenKeyResolver resolver = new SharedPlanTokenKeyResolver(redisProperties(KEY_PREFIX));

    @Test
    @DisplayName("키는 {key-prefix}:shared-plan:{SHA-256 앞 32 hex} 다 — 밖에서 계산한 값으로 고정한다")
    void keyIsPrefixedTruncatedSha256() {
        // python: hashlib.sha256(TOKEN.encode()).hexdigest()[:32]
        assertThat(resolve("/api/v1/shared-plans/" + TOKEN)).isEqualTo(KEY_PREFIX + ":shared-plan:8c257d4154976825127f7fe068fdc85c");
    }

    @Test
    @DisplayName("같은 토큰은 같은 키, 다른 토큰은 다른 키다")
    void sameTokenSameKeyOtherTokenOtherKey() {
        String key = resolve("/api/v1/shared-plans/" + TOKEN);

        assertThat(resolve("/api/v1/shared-plans/" + TOKEN)).isEqualTo(key);
        assertThat(resolve("/api/v1/shared-plans/" + OTHER_TOKEN)).isNotEqualTo(key);
    }

    @Test
    @DisplayName("키에 토큰 원문이 없다 — 토큰은 그 자체가 열람 권한이다")
    void keyDoesNotContainRawToken() {
        String key = resolve("/api/v1/shared-plans/" + TOKEN);

        assertThat(key).doesNotContain(TOKEN);
        assertThat(key).matches(KEY_PREFIX + ":shared-plan:[0-9a-f]{32}");
    }

    @Test
    @DisplayName("Redis key-prefix 가 키 안에 들어간다 — 비어 있으면 기본 접두어다 (dev Redis 는 다른 프로젝트와 함께 쓴다)")
    void keyCarriesRedisKeyPrefix() {
        SharedPlanTokenKeyResolver blankPrefix = new SharedPlanTokenKeyResolver(redisProperties("  "));

        assertThat(resolve("/api/v1/shared-plans/" + TOKEN)).startsWith("hondigagae:test:shared-plan:");
        assertThat(resolve(blankPrefix, "/api/v1/shared-plans/" + TOKEN)).startsWith("hondigagae:shared-plan:");
    }

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {
        "/api/v1/shared-plans/" + TOKEN + "?utm_source=kakao",
        "/api/v1/shared-plans/" + TOKEN + "/",
        "/api/v1/shared-plans/" + TOKEN + "/anything/below",
        "/api/v1/shared-plans/" + TOKEN + ";jsessionid=abc"
    })
    @DisplayName("쿼리스트링·뒤 슬래시·하위 경로·;매개변수는 같은 링크다")
    void decorationsShareTheBucket(String path) {
        assertThat(resolve(path)).isEqualTo(resolve("/api/v1/shared-plans/" + TOKEN));
    }

    @Test
    @DisplayName("퍼센트 인코딩으로 표기만 바꾼 토큰은 같은 키다 — 원문 세그먼트를 키로 쓰면 버킷을 무한히 새로 받는다")
    void percentEncodedVariantSharesTheBucket() {
        // %61 = 'a'. plan-service 는 경로 변수를 디코딩해 읽으므로 두 요청은 같은 일정을 같은 비용으로 연다.
        String encoded = "%61" + TOKEN.substring(1);

        assertThat(resolve("/api/v1/shared-plans/" + encoded)).isEqualTo(resolve("/api/v1/shared-plans/" + TOKEN));
        assertThat(resolve("/api/v1/shared-%70lans/" + TOKEN))
            .as("접두어 쪽 인코딩도 게이트웨이 라우트 술어와 plan-service 가 똑같이 디코딩해 받는다")
            .isEqualTo(resolve("/api/v1/shared-plans/" + TOKEN));
    }

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {
        "/api/v1/shared-plans/abc",
        "/api/v1/shared-plans/" + TOKEN + "%20",
        "/api/v1/shared-plans/" + TOKEN + "%20%20",
        "/api/v1/shared-plans/" + TOKEN + "x",
        "/api/v1/shared-plans/" + OTHER_TOKEN + "%20",
        "/api/v1/shared-plans/aG9uZGlnYWdhZS1zaGFyZWQtcGxhbi10b2tlbi0jMD",
        "/api/v1/shared-plans/aG9uZGlnYWdhZS1zaGFyZWQtcGxhbi10b2tlbi0jMD%2B",
        "/api/v1/shared-plans/aG9uZGlnYWdhZS1zaGFyZWQtcGxhbi10b2tlbi0jMD="
    })
    @DisplayName("발급 형식이 아닌 토큰은 모두 같은 malformed 키 하나다 — 뒤 공백 변형이 새 버킷을 받지 못한다")
    void malformedTokensShareOneBucket(String path) {
        assertThat(resolve(path)).isEqualTo(MALFORMED_KEY);
    }

    @Test
    @DisplayName("뒤 공백 변형은 원래 토큰의 해시 버킷과 갈린다 — 그 표기는 plan-service 가 열지 않으므로 증폭 없는 버킷 하나로 충분하다")
    void trailingSpaceVariantDoesNotGetItsOwnBucket() {
        String key = resolve("/api/v1/shared-plans/" + TOKEN);

        assertThat(resolve("/api/v1/shared-plans/" + TOKEN + "%20"))
            .isEqualTo(resolve("/api/v1/shared-plans/" + TOKEN + "%20%20"))
            .isNotEqualTo(key);
    }

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {
        "/api/v1/shared-plans",
        "/api/v1/shared-plans/",
        "/api/v1/shared-plans?token=" + TOKEN,
        "/api/v1/shared-plans//" + TOKEN,
        "/api/v1/plans/1",
        "/api/v1/places/shared-plans/" + TOKEN
    })
    @DisplayName("접두어 바로 뒤 토큰 세그먼트가 없으면 키가 없다")
    void noTokenSegmentYieldsNoKey(String path) {
        assertThat(resolver.resolve(exchange(path)).blockOptional()).isEmpty();
    }

    private String resolve(String path) {
        return resolve(resolver, path);
    }

    private static String resolve(SharedPlanTokenKeyResolver target, String path) {
        return target.resolve(exchange(path)).blockOptional()
            .orElseThrow(() -> new AssertionError("키가 나와야 한다: " + path));
    }

    /** 템플릿 문자열을 쓰면 {@code %} 가 다시 인코딩된다. 원문 그대로 보내려고 {@link URI} 로 넘긴다. */
    private static MockServerWebExchange exchange(String rawPathAndQuery) {
        return MockServerWebExchange.from(MockServerHttpRequest.method(HttpMethod.GET, URI.create(rawPathAndQuery)).build());
    }

    private static RedisProperties redisProperties(String keyPrefix) {
        return new RedisProperties(null, null, null, null, null, null, null, keyPrefix);
    }
}
