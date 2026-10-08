package com.hondigagae.apigateway.log;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.http.server.PathContainer;
import org.springframework.util.StringUtils;
import org.springframework.web.util.pattern.PathPattern;
import org.springframework.web.util.pattern.PathPattern.PathMatchInfo;
import org.springframework.web.util.pattern.PathPatternParser;

/**
 * 공유 토큰 마스킹 규칙을 입력표로 고정한다 (#627, #1281).
 *
 * <p>#1281 의 결함은 "마스킹은 원문 문자열을 보고, 라우팅은 디코딩한 세그먼트를 본다" 였다. 그래서 마지막 테스트는
 * 규칙 하나하나가 아니라 <b>불변식</b>을 본다 — 라우트 패턴이 토큰을 뽑아내는 입력이면, 가린 결과에 그 토큰이 없다.
 */
class ShareTokenLogMaskerTest {

    /** 발급 형식({@code [A-Za-z0-9_-]{43}}) 그대로의 토큰. 짧은 토큰은 다른 세그먼트에 우연히 들어 있어 단언이 흐려진다. */
    private static final String TOKEN = "b3RoZXJfdG9rZW5fZXhhbXBsZV92YWx1ZV8wMTIzNDU2Nzg";
    private static final String OTHER_TOKEN = "Zm9vYmFyX3Rva2VuX3NlY29uZF9leGFtcGxlXzAxMjM0NTY";

    /** {@code SharedPlanTokenKeyResolver} 와 같은 패턴 — 게이트웨이가 공유 토큰을 경로 변수로 읽는 방식이다. */
    private static final PathPattern SHARED_PLAN_ROUTE = new PathPatternParser().parse("/api/v1/shared-plans/{token}/**");

    static Stream<Arguments> pathCases() {
        return Stream.of(
            Arguments.of("평문", "/api/v1/shared-plans/" + TOKEN, "/api/v1/shared-plans/***"),
            Arguments.of("접두 세그먼트를 퍼센트 인코딩", "/api/v1/shared-%70lans/" + TOKEN, "/api/v1/shared-%70lans/***"),
            Arguments.of("접두 세그먼트에 매트릭스 변수", "/api/v1/shared-plans;x=1/" + TOKEN, "/api/v1/shared-plans;x=1/***"),
            Arguments.of("토큰 세그먼트에 매트릭스 변수 — 매개변수까지 지운다", "/api/v1/shared-plans/" + TOKEN + ";a=b", "/api/v1/shared-plans/***"),
            Arguments.of("토큰 문자를 퍼센트 인코딩", "/api/v1/shared-plans/%62" + TOKEN.substring(1), "/api/v1/shared-plans/***"),
            Arguments.of("뒤 세그먼트는 남는다", "/api/v1/shared-plans/" + TOKEN + "/items", "/api/v1/shared-plans/***/items"),
            Arguments.of("뒤 슬래시", "/api/v1/shared-plans/" + TOKEN + "/", "/api/v1/shared-plans/***/"),
            Arguments.of("대소문자를 가리지 않는다 — 넓게 가리는 쪽은 무해하다", "/api/v1/SHARED-PLANS/" + TOKEN, "/api/v1/SHARED-PLANS/***"),
            Arguments.of("앞에 빈 세그먼트", "/api/v1//shared-plans/" + TOKEN, "/api/v1//shared-plans/***"),
            Arguments.of("사이에 빈 세그먼트", "/api/v1/shared-plans//" + TOKEN, "/api/v1/shared-plans//***"),
            Arguments.of("매개변수뿐인 세그먼트는 건너뛴다", "/api/v1/shared-plans/;a=b/" + TOKEN, "/api/v1/shared-plans/;a=b/***"),
            Arguments.of("위치와 무관하다", "/api/v1/plans/../shared-plans/" + TOKEN, "/api/v1/plans/../shared-plans/***"),
            Arguments.of("여러 번 나오면 모두 가린다", "/shared-plans/" + TOKEN + "/shared-plans/" + OTHER_TOKEN, "/shared-plans/***/shared-plans/***"),
            Arguments.of("토큰 없이 접두어만 — 가릴 세그먼트가 없다", "/api/v1/shared-plans/", "/api/v1/shared-plans/"),
            Arguments.of("뒤 슬래시도 없는 접두어", "/api/v1/shared-plans", "/api/v1/shared-plans"),
            Arguments.of("다른 경로는 그대로", "/api/v1/plans/1234567890123456789", "/api/v1/plans/1234567890123456789"),
            Arguments.of("비슷한 이름은 공유 경로가 아니다", "/api/v1/my-shared-plans/abc", "/api/v1/my-shared-plans/abc"),
            Arguments.of("빈 경로", "", "")
        );
    }

    @ParameterizedTest(name = "[{index}] {0}")
    @MethodSource("pathCases")
    @DisplayName("경로 — 공유 세그먼트 바로 뒤 한 세그먼트의 원문 전체만 *** 로 바뀌고 나머지 모양은 그대로다")
    void masksPath(String description, String rawPath, String expected) {
        assertThat(ShareTokenLogMasker.maskPath(rawPath)).isEqualTo(expected);
    }

    @ParameterizedTest
    @MethodSource("undecodablePaths")
    @DisplayName("경로 — 퍼센트 인코딩이 깨져 읽지 못하면 원문을 남기지 않고 고정 문자열을 돌려준다")
    void hidesUndecodablePath(String rawPath) {
        String masked = ShareTokenLogMasker.maskPath(rawPath);

        assertThat(masked).isEqualTo(ShareTokenLogMasker.UNPARSABLE_PATH);
        assertThat(masked).doesNotContain(TOKEN.substring(0, 10));
    }

    static Stream<String> undecodablePaths() {
        return Stream.of(
            "/api/v1/shared-plans/" + TOKEN + "%ZZ",
            "/api/v1/shared-plans/" + TOKEN + "%4",
            "/api/v1/shared-%7Glans/" + TOKEN,
            "/api/v1/shared-plans;x=%ZZ/" + TOKEN
        );
    }

    @Test
    @DisplayName("경로 — null 은 null 이다. 로그 문 안에서 불리므로 예외를 던지지 않는다")
    void nullPathIsNull() {
        assertThat(ShareTokenLogMasker.maskPath(null)).isNull();
    }

    static Stream<Arguments> queryCases() {
        return Stream.of(
            Arguments.of("token=" + TOKEN, "token=***"),
            Arguments.of("%74oken=" + TOKEN, "%74oken=***"),
            Arguments.of("TOKEN=" + TOKEN, "TOKEN=***"),
            Arguments.of("token=" + TOKEN + "&trace=abc", "token=***&trace=abc"),
            Arguments.of("trace=abc&Token=" + TOKEN + "&debug=1", "trace=abc&Token=***&debug=1"),
            Arguments.of("token=" + TOKEN + "=tail", "token=***"),
            Arguments.of("%ZZ=" + TOKEN, "%ZZ=***"),
            Arguments.of("token=", "token=***"),
            Arguments.of("token", "token"),
            Arguments.of("mytoken=abc&token_type=xyz", "mytoken=abc&token_type=xyz"),
            Arguments.of("debug=1&&x=", "debug=1&&x="),
            Arguments.of("", "")
        );
    }

    @ParameterizedTest(name = "[{index}] {0}")
    @MethodSource("queryCases")
    @DisplayName("쿼리 — 디코딩한 이름이 token(대소문자 무시)인 파라미터의 값만 가린다")
    void masksQuery(String query, String expected) {
        assertThat(ShareTokenLogMasker.maskQuery(query)).isEqualTo(expected);
    }

    @Test
    @DisplayName("쿼리 — null 은 null 이다")
    void nullQueryIsNull() {
        assertThat(ShareTokenLogMasker.maskQuery(null)).isNull();
    }

    static Stream<Arguments> uriCases() {
        return Stream.of(
            Arguments.of(URI.create("http://gateway:8000/api/v1/shared-%70lans/" + TOKEN + "?%74oken=" + OTHER_TOKEN + "&x=1"),
                "http://gateway:8000/api/v1/shared-%70lans/***?%74oken=***&x=1"),
            Arguments.of(URI.create("/api/v1/shared-plans/" + TOKEN), "/api/v1/shared-plans/***"),
            Arguments.of(URI.create("http://gateway:8000/api/v1/plans?debug=1"), "http://gateway:8000/api/v1/plans?debug=1"),
            Arguments.of(URI.create("http://gateway:8000"), "http://gateway:8000"),
            Arguments.of(URI.create("http://gateway:8000/api/v1/places?"), "http://gateway:8000/api/v1/places?")
        );
    }

    @ParameterizedTest(name = "[{index}] {0}")
    @MethodSource("uriCases")
    @DisplayName("URI — scheme·authority 는 그대로, 경로와 쿼리는 같은 규칙으로 가린다")
    void masksUri(URI uri, String expected) {
        assertThat(ShareTokenLogMasker.maskUri(uri)).isEqualTo(expected);
    }

    @Test
    @DisplayName("URI — null 은 null 이다")
    void nullUriIsNull() {
        assertThat(ShareTokenLogMasker.maskUri(null)).isNull();
    }

    /**
     * 공유 세그먼트 · 토큰 · 꼬리의 표기를 조합해 <b>라우트에 맞는 입력만</b> 골라낸다. 조합 가운데 라우트에 맞지 않는 것
     * ({@code shared-Plans} 처럼 대소문자가 다른 것)은 게이트웨이가 공유 라우트로 보내지 않으므로 이 불변식의 대상이 아니다.
     */
    static Stream<String> routeMatchingPaths() {
        List<String> sharedSegments = List.of("shared-plans", "shared-%70lans", "%73hared-plans", "shared-plans;x=1", "shared-%70lans;x=1;y=2",
            "shared-%50lans");
        List<String> tokens = List.of(TOKEN, "%62" + TOKEN.substring(1), TOKEN + ";a=b", "%62" + TOKEN.substring(1) + ";a=%62");
        List<String> tails = List.of("", "/", "/items", "/items;k=v/deeper");

        return sharedSegments.stream()
            .flatMap(shared -> tokens.stream().flatMap(token -> tails.stream().map(tail -> "/api/v1/" + shared + "/" + token + tail)))
            .filter(path -> SHARED_PLAN_ROUTE.matches(PathContainer.parsePath(path)));
    }

    @ParameterizedTest
    @MethodSource("routeMatchingPaths")
    @DisplayName("불변식 — 라우트 패턴이 {token} 으로 뽑아내는 값은 가린 결과에 남지 않는다")
    void tokenExtractedByRouteNeverSurvivesMasking(String rawPath) {
        PathMatchInfo match = SHARED_PLAN_ROUTE.matchAndExtract(PathContainer.parsePath(rawPath));
        assertThat(match).as("입력표는 라우트에 맞는 경로만 담는다").isNotNull();

        String token = match.getUriVariables().get("token");
        assertThat(token).isEqualTo(TOKEN);
        String masked = ShareTokenLogMasker.maskPath(rawPath);
        assertThat(masked).doesNotContain(token);
        // %62... 처럼 인코딩된 채 남아도 읽는 사람이 풀면 그만이다 — 디코딩한 결과에도 없어야 한다.
        assertThat(StringUtils.uriDecode(masked, StandardCharsets.UTF_8)).doesNotContain(token);
    }

    @Test
    @DisplayName("불변식 입력표가 비어 있지 않다 — 필터가 모두 걸러내면 불변식 테스트가 아무것도 보지 않고 통과한다")
    void routeMatchingPathsAreNotEmpty() {
        assertThat(routeMatchingPaths().count()).isGreaterThanOrEqualTo(5L * 4 * 4);
    }
}
