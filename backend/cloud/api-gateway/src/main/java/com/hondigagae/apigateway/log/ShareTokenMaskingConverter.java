package com.hondigagae.apigateway.log;

import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.CoreConstants;
import ch.qos.logback.core.pattern.CompositeConverter;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 콘솔로 나가기 직전의 로그 문자열(메시지 + 스택트레이스 전체)에서 공유 링크 토큰을 지우는 logback 변환기 (#1281).
 *
 * <h2>왜 출력 단계인가</h2>
 *
 * <p>우리가 찍는 줄({@code LoggingGlobalApiGatewayFilter}, {@code JwtAuthExceptionWebHandler})은 {@link ShareTokenLogMasker} 를 직접
 * 거친다. 그런데 프레임워크도 요청 경로를 원문으로 찍고, 그 줄에는 고칠 자리가 없다.
 * <ul>
 *   <li>부트 오류 핸들러의 500 ERROR — {@code 500 Server Error for HTTP GET "<path>?<query>"}</li>
 *   <li>{@code HttpWebHandlerAdapter} — 오류 핸들러가 다시 던진 오류(응답이 이미 나갔거나 클라이언트가 끊겼다)를 같은 500 문구나
 *       {@code Error [..] for HTTP GET "..", but ServerHttpResponse already committed} 로 찍는다. 재정의할 지점이 없다</li>
 *   <li>{@code ExceptionHandlingWebHandler} 의 체크포인트 — 같은 Throwable 에 suppressed 로 붙어 스택트레이스의
 *       {@code *__checkpoint ⇢ HTTP GET "<path>?<query>"} 줄로 나온다. 로그 메시지를 가려도 여기서 샌다</li>
 * </ul>
 * 세 곳 모두 {@code HTTP <METHOD> "<path>[?<query>]"} 모양이라, 렌더된 문자열에서 그 따옴표 안을 masker 로 바꾼다. 라우트와 같은
 * 방식으로 읽으므로 {@code shared-%70lans}·매트릭스 변수 같은 비정규 표기도 덮인다.
 *
 * <h2>안전망</h2>
 *
 * <p>위 문구 밖에서는 정규형 {@code /shared-plans} 세그먼트(대소문자 무시, {@code ;매개변수} 허용) 뒤 한 세그먼트를 {@code ***} 로
 * 바꾼다. 세그먼트는 {@code / ? " #} 와 공백에서 끝난다. 비정규 표기를 문구 밖에서까지 찾지는 않는다.
 *
 * <h2>로그 문 밖에서 불린다 — 예외를 던지지 않는다</h2>
 *
 * <p>대부분의 줄은 {@code shared-plans} 도 {@code HTTP } 문구도 없어 같은 문자열을 그대로 돌려준다. 변환이 실패하면 토큰이 섞였을
 * 수 있으니 원문 대신 {@link #MASKING_FAILED} 를 내보낸다 — 날짜·레벨·로거 칸은 이 변환기 밖이라 그대로 남는다.
 *
 * <p>등록은 {@code logback-spring.xml} 의 {@code %maskShareToken(%m%n%wEx)} 이다. 스택트레이스 변환기({@code %wEx})가 이 안에 있어도
 * logback 의 {@code EnsureExceptionHandling} 이 컴포지트 안까지 보므로 스택트레이스를 한 번 더 붙이지 않는다.
 */
public class ShareTokenMaskingConverter extends CompositeConverter<ILoggingEvent> {

    static final String MASKING_FAILED = "<공유 토큰 마스킹 실패 — 원문을 남기지 않았다>";

    private static final String FRAMEWORK_REQUEST_MARKER = "HTTP ";
    private static final String SHARED_PLAN_SEGMENT = "shared-plans";

    /**
     * 프레임워크의 요청 문구. 따옴표 쪽이 부트 500·{@code HttpWebHandlerAdapter}·체크포인트, 따옴표 없는 쪽이 부트 DEBUG
     * ({@code Resolved [..] for HTTP GET <path>})다. 원문 경로에는 따옴표·공백이 올 수 없다(URI 로 읽히지 않는다).
     */
    private static final Pattern FRAMEWORK_REQUEST = Pattern.compile("HTTP ([A-Z]+) (?:\"([^\"\\r\\n]*)\"|(/[^\\s\"]*))");
    private static final Pattern CANONICAL_SHARED_PLAN_TOKEN = Pattern.compile("(?i)(/shared-plans(?:;[^/?\"#\\s]*)?/+)[^/?\"#\\s]+");
    private static final String CANONICAL_REPLACEMENT = "$1" + ShareTokenLogMasker.MASKED;

    @Override
    protected String transform(ILoggingEvent event, String in) {
        if (!mayCarryShareToken(in)) {
            return in;
        }
        try {
            return mask(in);
        } catch (RuntimeException failure) {
            return MASKING_FAILED + CoreConstants.LINE_SEPARATOR;
        }
    }

    protected String mask(String rendered) {
        return CANONICAL_SHARED_PLAN_TOKEN.matcher(maskFrameworkRequests(rendered)).replaceAll(CANONICAL_REPLACEMENT);
    }

    private static String maskFrameworkRequests(String rendered) {
        if (!rendered.contains(FRAMEWORK_REQUEST_MARKER)) {
            return rendered;
        }

        Matcher matcher = FRAMEWORK_REQUEST.matcher(rendered);
        StringBuilder masked = new StringBuilder(rendered.length());
        while (matcher.find()) {
            String quoted = matcher.group(2);
            String requestTarget = quoted != null ? '"' + maskRequestTarget(quoted) + '"' : maskRequestTarget(matcher.group(3));
            matcher.appendReplacement(masked, Matcher.quoteReplacement("HTTP " + matcher.group(1) + " " + requestTarget));
        }
        matcher.appendTail(masked);
        return masked.toString();
    }

    /** {@code <path>[?<query>]} — 원문 경로에는 {@code ?} 가 없으므로 첫 {@code ?} 가 경계다. */
    private static String maskRequestTarget(String requestTarget) {
        int queryAt = requestTarget.indexOf('?');
        if (queryAt < 0) {
            return ShareTokenLogMasker.maskPath(requestTarget);
        }
        return ShareTokenLogMasker.maskPath(requestTarget.substring(0, queryAt)) + "?"
            + ShareTokenLogMasker.maskQuery(requestTarget.substring(queryAt + 1));
    }

    private static boolean mayCarryShareToken(String rendered) {
        return rendered.contains(FRAMEWORK_REQUEST_MARKER) || containsIgnoreCase(rendered, SHARED_PLAN_SEGMENT);
    }

    private static boolean containsIgnoreCase(String text, String needle) {
        int lastStart = text.length() - needle.length();
        for (int start = 0; start <= lastStart; start++) {
            if (text.regionMatches(true, start, needle, 0, needle.length())) {
                return true;
            }
        }
        return false;
    }
}
