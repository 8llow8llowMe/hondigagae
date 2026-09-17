package com.hondigagae.domainlayer.plan.adapter.in.web.controller;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * {@code /api/v1} 컨트롤러의 모든 매핑 메서드가 {@code @PreAuthorize} 를 갖거나 <b>명시적 공개 목록</b>에
 * 있어야 한다.
 *
 * <h2>왜 이 테스트가 필요한가</h2>
 *
 * 이 저장소는 {@code ResourceServerSecurityConfigurer} 가 {@code anyRequest().permitAll()} 이고
 * <b>인증 경계를 {@code @PreAuthorize} 존재 여부로만</b> 표현한다. 그래서 어노테이션 한 줄이 지워지면
 * 그 API 는 <b>조용히 공개된다</b> — 컴파일도 기동도 기존 테스트도 아무것도 말해 주지 않고, 응답은
 * 200 이라 이상해 보이지도 않는다. 리팩토링 중 import 정리나 메서드 이동으로 충분히 일어날 수 있는 일이다.
 *
 * <p>{@code GatewayRouteCoverageTest} 와 같은 결이다 — 컴파일로 잡히지 않는 누락을 소스를 직접 읽어 대조한다.
 *
 * <p>{@code /internal/v1} 컨트롤러는 대상에서 뺀다. 게이트웨이가 그 접두어를 라우팅하지 않는 것이
 * 설계라 외부에서 도달할 수 없다 (architecture-guide §2).
 */
class WebControllerAuthorizationCoverageTest {

    /**
     * <b>여기 클래스를 추가하는 것은 "그 컨트롤러의 모든 엔드포인트를 인증 없이 공개한다" 는 뜻이다.</b>
     * 추가하기 전에 그 API 가 남의 자료를 돌려줄 수 있는지 반드시 확인한다.
     *
     * <ul>
     *   <li>{@code SharedPlanWebController} — 일정 공유 링크의 공개 조회(#627). 인증 대신 <b>토큰</b>이
     *       권한이고, 응답에서 주인만 쓰는 필드(예산·반려견·메모 등)를 빼는 것으로 노출 범위를 좁힌다
     * </ul>
     */
    private static final Set<String> INTENTIONALLY_PUBLIC_CONTROLLERS = Set.of("SharedPlanWebController");

    /** Gradle 은 모듈 디렉터리에서 테스트를 돌린다. */
    private static final Path CONTROLLER_ROOT = Path.of("src", "main", "java").toAbsolutePath().normalize();

    private static final Pattern CLASS_REQUEST_MAPPING = Pattern.compile("@RequestMapping\\(\\s*\"(/api/v1/[^\"]*)\"");
    private static final Pattern MAPPING_ANNOTATION = Pattern.compile("@(?:Get|Post|Put|Delete|Patch)Mapping\\b");
    private static final Pattern MAPPING_METHOD =
        Pattern.compile("@(?:Get|Post|Put|Delete|Patch)Mapping\\b[\\s\\S]{0,400}?\\b(?:public|protected|private)\\s");
    private static final Pattern PRE_AUTHORIZE = Pattern.compile("@PreAuthorize\\b");

    @Test
    @DisplayName("/api/v1 컨트롤러의 매핑 메서드는 @PreAuthorize 를 갖거나 공개 허용 목록에 있어야 한다")
    void everyWebEndpointIsAuthenticatedOrExplicitlyPublic() throws IOException {
        List<String> unprotected = new ArrayList<>();
        Set<String> scanned = new TreeSet<>();
        int endpoints = 0;

        for (Path controller : webControllers()) {
            String source = Files.readString(controller, StandardCharsets.UTF_8);
            String className = controller.getFileName().toString().replace(".java", "");
            if (!CLASS_REQUEST_MAPPING.matcher(source).find()) {
                continue;
            }
            scanned.add(className);

            // 매핑 어노테이션 수와 실제로 훑은 메서드 수가 같아야 한다 — 다르면 아래 정규식이
            // 엔드포인트를 놓치고 있다는 뜻이고, 그러면 이 테스트는 아무것도 증명하지 못한 채 통과한다.
            List<String> methods = mappingMethodBlocksOf(source);
            assertThat(methods)
                .as("%s 의 매핑 어노테이션을 하나도 빠짐없이 훑어야 한다", className)
                .hasSize((int) MAPPING_ANNOTATION.matcher(source).results().count());
            endpoints += methods.size();

            if (INTENTIONALLY_PUBLIC_CONTROLLERS.contains(className)) {
                continue;
            }
            methods.stream()
                .filter(block -> !PRE_AUTHORIZE.matcher(block).find())
                .map(block -> className + " : " + firstLineOf(block))
                .forEach(unprotected::add);
        }

        assertThat(scanned)
            .as("대조할 컨트롤러가 없으면 경로 계산이 틀린 것이다 — 컨트롤러 루트: %s", CONTROLLER_ROOT)
            .isNotEmpty();
        assertThat(endpoints)
            .as("엔드포인트를 하나도 못 찾았다면 이 테스트는 아무것도 지키지 못한다")
            .isPositive();
        assertThat(unprotected)
            .as("@PreAuthorize 도 없고 공개 허용 목록에도 없는 엔드포인트 — 이 저장소에서는 그대로 공개 API 가 된다")
            .isEmpty();
    }

    @Test
    @DisplayName("공개 허용 목록의 컨트롤러는 실제로 존재한다 — 이름이 낡으면 허용이 조용히 넓어진다")
    void publicAllowListMatchesRealControllers() throws IOException {
        Set<String> existing = new TreeSet<>();
        for (Path controller : webControllers()) {
            existing.add(controller.getFileName().toString().replace(".java", ""));
        }

        assertThat(existing).containsAll(INTENTIONALLY_PUBLIC_CONTROLLERS);
    }

    @Test
    @DisplayName("공개 컨트롤러는 인증 주체를 읽지 않는다 — permitAll 경로에서 @AuthenticationPrincipal 은 항상 null 이다")
    void publicControllersDoNotResolveAnAuthenticatedMember() throws IOException {
        for (Path controller : webControllers()) {
            String className = controller.getFileName().toString().replace(".java", "");
            if (!INTENTIONALLY_PUBLIC_CONTROLLERS.contains(className)) {
                continue;
            }
            String source = Files.readString(controller, StandardCharsets.UTF_8);

            assertThat(source)
                .as("%s 는 공개 컨트롤러라 MemberLoginActive 를 주입받으면 안 된다", className)
                .doesNotContain("import com.hondigagae.security.common.dto.MemberLoginActive;")
                .doesNotContain("@AuthenticationPrincipal");
        }
    }

    /**
     * {@code adapter/in/web/controller/**} 의 {@code *Controller.java}.
     *
     * <p>{@code adapter/in/internal/**} 은 경로에서 자연히 빠진다 — 게이트웨이가 라우팅하지 않는 접두어다.
     */
    private static List<Path> webControllers() throws IOException {
        try (Stream<Path> files = Files.walk(CONTROLLER_ROOT)) {
            return files
                .filter(path -> path.getFileName().toString().endsWith("Controller.java"))
                .filter(path -> path.getParent() != null && path.getParent().endsWith(Path.of("in", "web", "controller")))
                .toList();
        }
    }

    /**
     * 매핑 어노테이션부터 그 뒤 첫 메서드 선언까지의 구간들.
     *
     * <p>구간으로 훑는 이유는 어노테이션 순서를 강제하지 않기 위해서다 — {@code @PreAuthorize} 가
     * 매핑 위에 오든 아래에 오든 같게 읽혀야 한다.
     */
    private static List<String> mappingMethodBlocksOf(String source) {
        List<String> blocks = new ArrayList<>();
        Matcher matcher = MAPPING_METHOD.matcher(source);
        while (matcher.find()) {
            blocks.add(matcher.group());
        }
        return blocks;
    }

    private static String firstLineOf(String block) {
        int newline = block.indexOf('\n');
        return newline < 0 ? block : block.substring(0, newline);
    }
}
