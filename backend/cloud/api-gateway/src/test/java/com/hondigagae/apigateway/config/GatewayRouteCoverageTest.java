package com.hondigagae.apigateway.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.yaml.snakeyaml.Yaml;

/**
 * 컨트롤러가 여는 {@code /api/v1/*} 접두어마다 게이트웨이 라우트가 있는지 대조한다.
 *
 * <p>같은 실수가 두 번 있었다 — {@code /insights}(3254d13), {@code /favorites}(#202). 컨트롤러는 서비스 안에서
 * 멀쩡히 동작하고 Swagger 에도 뜨는데 프론트엔드는 절대 도달할 수 없고, 게이트웨이가 내는 404 는
 * "라우트 미등록" 인지 "리소스 없음" 인지 구분되지 않아 한참 뒤에 발견된다. 컴파일로도 기동으로도 잡히지 않는
 * 종류라 소스를 직접 읽어 대조한다.
 *
 * <p>대조 방향은 한쪽이다: <b>컨트롤러 접두어 ⊆ 라우트</b>. 라우트만 있고 컨트롤러가 아직 없는 경로
 * ({@code /walk-courses}·{@code /assistant}, 미착수 기능)는 프론트가 부를 일이 없어 문제가 아니다.
 * {@code /internal/v1} 은 게이트웨이가 라우팅하지 않는 것이 설계라 제외한다 (architecture-guide §2).
 *
 * <p>다른 모듈의 소스를 파일 시스템으로 읽는 것은 이 저장소 레이아웃({@code backend/service/*})에 묶인 선택이다 —
 * 서비스 모듈에 의존을 걸면 게이트웨이가 모든 서비스를 컴파일 시점에 끌어안게 되어 더 나쁘다.
 */
class GatewayRouteCoverageTest {

    /** Gradle 은 모듈 디렉터리에서 테스트를 돌린다. 여기서 두 단계 위가 backend/ 다. */
    private static final Path SERVICE_ROOT = Path.of("..", "..", "service").toAbsolutePath().normalize();
    private static final Pattern REQUEST_MAPPING = Pattern.compile("@RequestMapping\\(\\s*\"(/api/v1/[^/\"]+)");
    private static final Pattern ROUTE_PATH = Pattern.compile("^Path=(/api/v1/[^/]+)/\\*\\*$");

    @ParameterizedTest(name = "application-{0}.yml")
    @ValueSource(strings = {"local", "dev", "prod"})
    @DisplayName("컨트롤러가 여는 /api/v1 접두어는 세 프로파일 모두에 라우트가 있어야 한다")
    void everyControllerPrefixHasARoute(String profile) throws IOException {
        Set<String> controllerPrefixes = controllerPrefixes();
        Set<String> routedPrefixes = routedPrefixes(profile);

        assertThat(controllerPrefixes)
            .as("대조할 컨트롤러가 없으면 경로 계산이 틀린 것이다 — service 루트: %s", SERVICE_ROOT)
            .isNotEmpty();
        assertThat(routedPrefixes)
            .as("컨트롤러가 여는 접두어 중 application-%s.yml 에 라우트가 없는 것", profile)
            .containsAll(controllerPrefixes);
    }

    /**
     * {@code backend/service/*}/src/main/java 의 *Controller.java 에서 {@code @RequestMapping("/api/v1/...")} 의 첫 마디.
     *
     * <p>서비스마다 {@code src/main/java} 만 걷는다 — 서비스 루트째 걸으면 {@code build/}(클래스·리포트·캐시)까지
     * 순회해 프로파일 3회 × 서비스 수만큼 느려진다.
     */
    private static Set<String> controllerPrefixes() throws IOException {
        Set<String> prefixes = new TreeSet<>();
        for (Path sourceRoot : mainSourceRoots()) {
            try (Stream<Path> files = Files.walk(sourceRoot)) {
                List<Path> controllers = files
                    .filter(path -> path.getFileName().toString().endsWith("Controller.java"))
                    .toList();
                for (Path controller : controllers) {
                    Matcher matcher = REQUEST_MAPPING.matcher(Files.readString(controller, StandardCharsets.UTF_8));
                    while (matcher.find()) {
                        prefixes.add(matcher.group(1));
                    }
                }
            }
        }
        return prefixes;
    }

    private static List<Path> mainSourceRoots() throws IOException {
        try (Stream<Path> services = Files.list(SERVICE_ROOT)) {
            return services
                .map(service -> service.resolve("src").resolve("main").resolve("java"))
                .filter(Files::isDirectory)
                .toList();
        }
    }

    /**
     * 프로파일 yml 의 {@code spring.cloud.gateway.routes[].predicates} 중 {@code Path=/api/v1/xxx/**} 의 접두어.
     *
     * <p>구조를 한 단계씩 확인하며 내려간다 — yml 이 깨졌을 때 NPE 대신 "어느 키가 없는지" 가 실패 메시지에 남아야 한다.
     */
    private static Set<String> routedPrefixes(String profile) throws IOException {
        try (InputStream yml = GatewayRouteCoverageTest.class.getResourceAsStream("/application-" + profile + ".yml")) {
            assertThat(yml).as("application-%s.yml 이 클래스패스에 있어야 한다", profile).isNotNull();
            Map<String, Object> root = new Yaml().load(yml);
            List<?> routes = asList(section(section(section(root, "spring", profile), "cloud", profile), "gateway", profile)
                .get("routes"), "spring.cloud.gateway.routes", profile);

            Set<String> prefixes = new TreeSet<>();
            for (Object route : routes) {
                Object predicates = asMap(route, "routes[]", profile).get("predicates");
                if (predicates == null) {
                    continue;
                }
                for (Object predicate : asList(predicates, "routes[].predicates", profile)) {
                    Matcher matcher = ROUTE_PATH.matcher(String.valueOf(predicate));
                    if (matcher.matches()) {
                        prefixes.add(matcher.group(1));
                    }
                }
            }
            return prefixes;
        }
    }

    private static Map<?, ?> section(Map<?, ?> parent, String key, String profile) {
        return asMap(parent.get(key), key, profile);
    }

    private static Map<?, ?> asMap(Object value, String name, String profile) {
        assertThat(value).as("application-%s.yml 의 %s 는 매핑이어야 한다", profile, name).isInstanceOf(Map.class);
        return (Map<?, ?>) value;
    }

    private static List<?> asList(Object value, String name, String profile) {
        assertThat(value).as("application-%s.yml 의 %s 는 목록이어야 한다", profile, name).isInstanceOf(List.class);
        return (List<?>) value;
    }
}
