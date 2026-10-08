package com.hondigagae.apigateway.log;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import ch.qos.logback.core.CoreConstants;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.util.StringUtils;

/**
 * 출력 단계 변환기의 문자열 규칙을 고정한다 (#1281).
 *
 * <p>프레임워크는 요청을 셋 가운데 한 모양으로 찍는다. 모두 원문 경로와 원문 쿼리다.
 * <ul>
 *   <li>부트 {@code AbstractErrorWebExceptionHandler} 의 500 — {@code [id] 500 Server Error for HTTP GET "<path>?<query>"}
 *   <li>{@code HttpWebHandlerAdapter#handleUnresolvedError} — 같은 500 문구, 그리고 응답이 이미 나갔을 때의
 *       {@code Error [..] for HTTP GET "<path>?<query>", but ServerHttpResponse already committed (..)}
 *   <li>{@code ExceptionHandlingWebHandler} 의 체크포인트 — 스택트레이스의 {@code Suppressed:} 아래
 *       {@code *__checkpoint ⇢ HTTP GET "<path>?<query>" [ExceptionHandlingWebHandler]}
 * </ul>
 *
 * <p>"응답이 이미 나갔다" 갈래는 실제 체인으로 재현하지 않고 여기서 문구 그대로 넣어 본다. 업스트림이 헤더를 보낸 뒤
 * 본문 도중에 끊기게 만들어야 하는데, 그 시점이 Netty 스케줄에 달려 있어 테스트가 흔들린다. 문구는 spring-web 6.2.6
 * {@code HttpWebHandlerAdapter} 원본에서 옮겼다.
 */
class ShareTokenMaskingConverterTest {

    private static final String TOKEN = "b3RoZXJfdG9rZW5fZXhhbXBsZV92YWx1ZV8wMTIzNDU2Nzg";
    private static final String QUERY_TOKEN = "Zm9vYmFyX3Rva2VuX3NlY29uZF9leGFtcGxlXzAxMjM0NTY";

    private final ShareTokenMaskingConverter converter = new ShareTokenMaskingConverter();

    /** 라우트가 같은 공유 링크로 읽는 표기들 — 정규형만 보는 안전망으로는 둘째 줄부터 못 가린다. */
    static List<String> requestTargets() {
        return List.of(
            "/api/v1/shared-plans/" + TOKEN + "?token=" + QUERY_TOKEN,
            "/api/v1/shared-%70lans/" + TOKEN + "?%74oken=" + QUERY_TOKEN,
            "/api/v1/shared-plans;x=1/" + TOKEN + ";a=b/items",
            "/api/v1/%73hared-plans/%62" + TOKEN.substring(1) + "?trace=abc"
        );
    }

    static Stream<Arguments> frameworkPhrases() {
        return requestTargets().stream().flatMap(target -> Stream.of(
            Arguments.of("부트 500", "[1a2b3c4d-7] 500 Server Error for HTTP GET \"" + target + "\""),
            Arguments.of("어댑터 500", "[1a2b3c4d-7] 500 Server Error for HTTP POST \"" + target + "\""),
            Arguments.of("어댑터 커밋 뒤 오류",
                "[1a2b3c4d-7] Error [java.lang.IllegalStateException: boom] for HTTP GET \"" + target
                    + "\", but ServerHttpResponse already committed (200 OK)"),
            Arguments.of("체크포인트",
                "java.lang.IllegalStateException: boom\n\tat x.Y.z(Y.java:1)\n\tSuppressed: reactor.core.publisher.FluxOnAssembly$OnAssemblyException: \n"
                    + "Error has been observed at the following site(s):\n\t*__checkpoint ⇢ HTTP GET \"" + target
                    + "\" [ExceptionHandlingWebHandler]\nOriginal Stack Trace:\n\t\tat x.Y.z(Y.java:1)\n")
        ));
    }

    @ParameterizedTest(name = "[{index}] {0}")
    @MethodSource("frameworkPhrases")
    @DisplayName("프레임워크 문구의 경로·쿼리는 표기를 바꿔도 토큰이 남지 않는다 — 디코딩해 읽어도 없다")
    void masksFrameworkRequestPhrase(String description, String rendered) {
        String masked = converter.transform(null, rendered);

        assertThat(masked).doesNotContain(TOKEN).doesNotContain(QUERY_TOKEN).contains("/***");
        assertThat(StringUtils.uriDecode(masked, StandardCharsets.UTF_8)).doesNotContain(TOKEN).doesNotContain(QUERY_TOKEN);
    }

    @Test
    @DisplayName("문구의 모양은 그대로다 — 따옴표 안의 토큰 자리만 바뀐다")
    void keepsPhraseShape() {
        String target = "/api/v1/shared-%70lans/" + TOKEN + ";a=b/items?%74oken=" + QUERY_TOKEN + "&trace=abc";

        assertThat(converter.transform(null, "[id-1] 500 Server Error for HTTP GET \"" + target + "\""))
            .isEqualTo("[id-1] 500 Server Error for HTTP GET \"/api/v1/shared-%70lans/***/items?%74oken=***&trace=abc\"");
        assertThat(converter.transform(null, "[id-1] Error [x] for HTTP GET \"" + target + "\", but ServerHttpResponse already committed (200 OK)"))
            .isEqualTo("[id-1] Error [x] for HTTP GET \"/api/v1/shared-%70lans/***/items?%74oken=***&trace=abc\", "
                + "but ServerHttpResponse already committed (200 OK)");
        assertThat(converter.transform(null, "\t*__checkpoint ⇢ HTTP GET \"" + target + "\" [ExceptionHandlingWebHandler]"))
            .isEqualTo("\t*__checkpoint ⇢ HTTP GET \"/api/v1/shared-%70lans/***/items?%74oken=***&trace=abc\" [ExceptionHandlingWebHandler]");
    }

    @Test
    @DisplayName("부트 DEBUG 의 따옴표 없는 문구(Resolved [..] for HTTP GET <path>)도 가린다")
    void masksUnquotedBootDebugPhrase() {
        String rendered = "[id-1] Resolved [IllegalStateException: boom] for HTTP GET /api/v1/shared-%70lans/" + TOKEN;

        assertThat(converter.transform(null, rendered))
            .isEqualTo("[id-1] Resolved [IllegalStateException: boom] for HTTP GET /api/v1/shared-%70lans/***");
    }

    static Stream<Arguments> canonicalSegments() {
        return Stream.of(
            Arguments.of("path=/api/v1/shared-plans/" + TOKEN, "path=/api/v1/shared-plans/***"),
            Arguments.of("Exchange: GET http://localhost:8000/api/v1/SHARED-PLANS;v=1/" + TOKEN + "/items?x=1",
                "Exchange: GET http://localhost:8000/api/v1/SHARED-PLANS;v=1/***/items?x=1"),
            Arguments.of("url \"/api/v1/shared-plans/" + TOKEN + "\" done", "url \"/api/v1/shared-plans/***\" done"),
            Arguments.of("/api/v1/shared-plans/" + TOKEN + "#frag", "/api/v1/shared-plans/***#frag"),
            Arguments.of("/api/v1/shared-plans/" + TOKEN + " next", "/api/v1/shared-plans/*** next"),
            Arguments.of("/api/v1/shared-plans//" + TOKEN, "/api/v1/shared-plans//***"),
            Arguments.of("a /shared-plans/" + TOKEN + "\nb /shared-plans/" + QUERY_TOKEN, "a /shared-plans/***\nb /shared-plans/***"),
            Arguments.of("/api/v1/shared-plans/", "/api/v1/shared-plans/"),
            Arguments.of("/api/v1/shared-plans", "/api/v1/shared-plans"),
            Arguments.of("Route matched: plan-service-shared-plans", "Route matched: plan-service-shared-plans")
        );
    }

    @ParameterizedTest(name = "[{index}] {0}")
    @MethodSource("canonicalSegments")
    @DisplayName("안전망 — 문구 밖의 정규형 shared-plans 세그먼트 뒤 한 세그먼트를 가린다")
    void masksCanonicalSegmentAnywhere(String rendered, String expected) {
        assertThat(converter.transform(null, rendered)).isEqualTo(expected);
    }

    static Stream<String> tokenFreeLines() {
        return Stream.of(
            "[요청] 요청ID=abc 메서드=GET URI=/api/v1/plans/1 클라이언트IP=127.0.0.1" + CoreConstants.LINE_SEPARATOR,
            "Started ApiGatewayApplication in 3.2 seconds" + CoreConstants.LINE_SEPARATOR,
            "java.lang.IllegalStateException: boom\n\tat x.Y.z(Y.java:1)\n",
            ""
        );
    }

    @ParameterizedTest
    @MethodSource("tokenFreeLines")
    @DisplayName("shared-plans 도 HTTP 문구도 없는 줄은 손대지 않고 같은 문자열을 그대로 돌려준다 — 대부분의 줄이 여기다")
    void passesTokenFreeLinesThrough(String rendered) {
        assertThat(converter.transform(null, rendered)).isSameAs(rendered);
    }

    @Test
    @DisplayName("토큰 없는 프레임워크 문구는 글자 그대로다")
    void leavesTokenFreePhraseUnchanged() {
        String rendered = "[id-1] 500 Server Error for HTTP GET \"/api/v1/plans/1?debug=1\"";

        assertThat(converter.transform(null, rendered)).isEqualTo(rendered);
    }

    @Test
    @DisplayName("문구의 경로를 읽지 못하면(깨진 % 인코딩) 원문 대신 고정 문자열이 들어간다")
    void hidesUndecodableQuotedPath() {
        String rendered = "[id-1] 500 Server Error for HTTP GET \"/api/v1/shared-%7Glans/" + TOKEN + "\"";

        assertThat(converter.transform(null, rendered))
            .isEqualTo("[id-1] 500 Server Error for HTTP GET \"" + ShareTokenLogMasker.UNPARSABLE_PATH + "\"");
    }

    @Test
    @DisplayName("변환이 실패해도 예외를 던지지 않고, 원문 대신 고정 문자열을 내보낸다")
    void neverPropagatesFailure() {
        ShareTokenMaskingConverter failing = new ShareTokenMaskingConverter() {
            @Override
            protected String mask(String rendered) {
                throw new IllegalStateException("변환 실패 흉내");
            }
        };
        String rendered = "[id-1] 500 Server Error for HTTP GET \"/api/v1/shared-plans/" + TOKEN + "\"";

        assertThatCode(() -> failing.transform(null, rendered)).doesNotThrowAnyException();
        assertThat(failing.transform(null, rendered))
            .isEqualTo(ShareTokenMaskingConverter.MASKING_FAILED + CoreConstants.LINE_SEPARATOR)
            .doesNotContain(TOKEN);
    }
}
