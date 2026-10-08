package com.hondigagae.apigateway.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.yaml.snakeyaml.Yaml;

/**
 * 레이트 리밋이 <b>공유 링크 공개 라우트에만, 같은 한도로</b> 걸려 있는지 세 프로파일 yml 을 직접 읽어 대조한다 (#1244).
 *
 * <p>컴파일로도 기동으로도 잡히지 않는 종류다 — 한 프로파일에서 필터를 빠뜨리면 그 환경만 조용히 무방비가 되고,
 * 한도 값이 프로파일마다 갈리면 dev 에서 확인한 동작이 운영과 다르다. {@code GatewayRouteCoverageTest} 와 같은
 * 방식으로 yml 을 구조째 읽는다.
 *
 * <p>기본 {@code RequestRateLimiter} 가 어디에도 없다는 것도 함께 본다. 그 필터는 거부를 <b>빈 본문</b>의 429 로
 * 내므로 봉투 계약(api-design-guide §2-2)을 깬다.
 */
class RateLimitRouteCoverageTest {

    private static final String RATE_LIMIT_FILTER = "SharedPlanRateLimit";
    private static final String DEFAULT_RATE_LIMIT_FILTER = "RequestRateLimiter";
    private static final String SHARED_PLAN_ROUTE = "plan-service-shared-plans";

    /** 세 프로파일 공통 한도 — 링크당 초당 2개 보충, 버스트 20 (이슈 #1244 설계 결정). */
    private static final Map<String, String> EXPECTED_ARGS = new TreeMap<>(Map.of(
        "redis-rate-limiter.replenishRate", "2",
        "redis-rate-limiter.burstCapacity", "20",
        "redis-rate-limiter.requestedTokens", "1"));

    @ParameterizedTest(name = "application-{0}.yml")
    @ValueSource(strings = {"local", "dev", "prod"})
    @DisplayName("SharedPlanRateLimit 필터는 plan-service-shared-plans 라우트에만, 한 번만 걸린다")
    void rateLimitOnlyOnSharedPlanRoute(String profile) throws IOException {
        Map<String, List<FilterSpec>> rateLimitedRoutes = filtersNamed(RATE_LIMIT_FILTER, profile);

        assertThat(rateLimitedRoutes.keySet())
            .as("application-%s.yml 에서 SharedPlanRateLimit 을 건 라우트", profile)
            .containsExactly(SHARED_PLAN_ROUTE);
        assertThat(rateLimitedRoutes.get(SHARED_PLAN_ROUTE))
            .as("application-%s.yml 의 %s 에 SharedPlanRateLimit 이 한 번만 있어야 한다", profile, SHARED_PLAN_ROUTE)
            .hasSize(1);
    }

    @ParameterizedTest(name = "application-{0}.yml")
    @ValueSource(strings = {"local", "dev", "prod"})
    @DisplayName("공유 링크 한도는 세 프로파일 모두 replenishRate 2 · burstCapacity 20 · requestedTokens 1 이다")
    void sharedPlanRouteLimitIsTheAgreedOne(String profile) throws IOException {
        List<FilterSpec> filters = filtersNamed(RATE_LIMIT_FILTER, profile).get(SHARED_PLAN_ROUTE);

        assertThat(filters).as("application-%s.yml 의 %s 에 SharedPlanRateLimit 이 있어야 한다", profile, SHARED_PLAN_ROUTE)
            .isNotNull()
            .hasSize(1);
        assertThat(filters.get(0).args())
            .as("application-%s.yml 의 SharedPlanRateLimit args", profile)
            .isEqualTo(EXPECTED_ARGS);
    }

    @ParameterizedTest(name = "application-{0}.yml")
    @ValueSource(strings = {"local", "dev", "prod"})
    @DisplayName("기본 RequestRateLimiter 는 어느 라우트에도 없다 — 거부가 빈 본문이라 봉투 계약을 깬다")
    void defaultRequestRateLimiterIsNotUsed(String profile) throws IOException {
        assertThat(filtersNamed(DEFAULT_RATE_LIMIT_FILTER, profile))
            .as("application-%s.yml 에서 RequestRateLimiter 를 건 라우트", profile)
            .isEmpty();
    }

    /**
     * 라우트 id → 그 라우트에 걸린 {@code name} 필터들.
     *
     * <p>필터는 두 표기를 모두 읽는다 — 줄임형({@code - SharedPlanRateLimit=...})과 전개형({@code - name: SharedPlanRateLimit / args: ...}).
     * 한쪽만 읽으면 다른 표기로 건 필터를 "없다" 고 오판한다.
     */
    private static Map<String, List<FilterSpec>> filtersNamed(String name, String profile) throws IOException {
        Map<String, List<FilterSpec>> byRoute = new LinkedHashMap<>();
        for (Object route : routes(profile)) {
            Map<?, ?> routeMap = asMap(route, "routes[]", profile);
            Object filters = routeMap.get("filters");
            if (filters == null) {
                continue;
            }
            for (Object filter : asList(filters, "routes[].filters", profile)) {
                FilterSpec spec = FilterSpec.of(filter, profile);
                if (name.equals(spec.name())) {
                    byRoute.computeIfAbsent(String.valueOf(routeMap.get("id")), ignored -> new ArrayList<>()).add(spec);
                }
            }
        }
        return byRoute;
    }

    private static List<?> routes(String profile) throws IOException {
        try (InputStream yml = RateLimitRouteCoverageTest.class.getResourceAsStream("/application-" + profile + ".yml")) {
            assertThat(yml).as("application-%s.yml 이 클래스패스에 있어야 한다", profile).isNotNull();
            Map<String, Object> root = new Yaml().load(yml);
            Map<?, ?> gateway = asMap(asMap(asMap(root.get("spring"), "spring", profile).get("cloud"), "cloud", profile)
                .get("gateway"), "gateway", profile);
            return asList(gateway.get("routes"), "spring.cloud.gateway.routes", profile);
        }
    }

    private static Map<?, ?> asMap(Object value, String name, String profile) {
        assertThat(value).as("application-%s.yml 의 %s 는 매핑이어야 한다", profile, name).isInstanceOf(Map.class);
        return (Map<?, ?>) value;
    }

    private static List<?> asList(Object value, String name, String profile) {
        assertThat(value).as("application-%s.yml 의 %s 는 목록이어야 한다", profile, name).isInstanceOf(List.class);
        return (List<?>) value;
    }

    /** 필터 하나. {@code args} 는 값까지 문자열로 맞춘다 — yml 의 {@code 2} 는 정수로, 게이트웨이는 문자열로 받는다. */
    private record FilterSpec(String name, Map<String, String> args) {

        private static FilterSpec of(Object filter, String profile) {
            if (filter instanceof String shortcut) {
                int separator = shortcut.indexOf('=');
                return new FilterSpec(separator < 0 ? shortcut : shortcut.substring(0, separator), Map.of());
            }
            Map<?, ?> expanded = asMap(filter, "routes[].filters[]", profile);
            Map<String, String> args = new TreeMap<>();
            Object rawArgs = expanded.get("args");
            if (rawArgs != null) {
                asMap(rawArgs, "routes[].filters[].args", profile)
                    .forEach((key, value) -> args.put(String.valueOf(key), String.valueOf(value)));
            }
            return new FilterSpec(String.valueOf(expanded.get("name")), args);
        }
    }
}
