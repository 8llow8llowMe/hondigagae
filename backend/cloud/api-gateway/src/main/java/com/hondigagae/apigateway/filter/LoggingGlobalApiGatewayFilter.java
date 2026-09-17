package com.hondigagae.apigateway.filter;

import java.util.UUID;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@Slf4j
@Component
public class LoggingGlobalApiGatewayFilter implements GlobalFilter, Ordered {

    private static final String REQUEST_ID_HEADER = "X-Request-ID";
    private static final String REQUEST_START_TIME = "requestStartTime";
    private static final long SLOW_REQUEST_THRESHOLD_MS = 3000;

    /** 뒤 세그먼트가 일정 공유 토큰인 경로 (#627). 토큰 하나가 곧 열람 권한이다. */
    private static final String SHARED_PLAN_PREFIX = "/api/v1/shared-plans/";
    private static final String MASKED_SEGMENT = "***";
    private static final String SEGMENT_TERMINATORS = "/?#";

    /**
     * 쿼리스트링의 {@code token=} 값. 현재 계약은 토큰을 경로로만 받지만, 쿼리로 옮기거나 덧붙이는
     * 변경이 오면 마스킹 밖으로 빠져나가는 <b>회귀 경로</b>라 미리 막아 둔다.
     */
    private static final Pattern TOKEN_QUERY_PARAMETER = Pattern.compile("(?i)(^|[?&])token=[^&#]*");
    private static final String MASKED_TOKEN_QUERY_PARAMETER = "$1token=" + MASKED_SEGMENT;

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String requestId = getOrCreateRequestId(exchange.getRequest());
        exchange.getAttributes().put(REQUEST_ID_HEADER, requestId);

        long startTime = System.currentTimeMillis();
        exchange.getAttributes().put(REQUEST_START_TIME, startTime);

        logRequest(exchange, requestId);

        return chain.filter(exchange)
            .doFinally(signalType -> logResponse(exchange, requestId, startTime));
    }

    private String getOrCreateRequestId(ServerHttpRequest request) {
        String requestId = request.getHeaders().getFirst(REQUEST_ID_HEADER);
        return (requestId != null) ? requestId : UUID.randomUUID().toString();
    }

    private void logRequest(ServerWebExchange exchange, String requestId) {
        ServerHttpRequest request = exchange.getRequest();

        String query = request.getURI().getQuery();

        log.info("[요청] 요청ID={} 메서드={} URI={} 클라이언트IP={} UserAgent={} 인증헤더존재={} 쿼리={}",
            requestId, request.getMethod(), maskShareTokens(request.getURI().toString()), getClientIp(request),
            getUserAgent(request), request.getHeaders().containsKey(HttpHeaders.AUTHORIZATION),
            query != null ? maskShareTokens(query) : "없음"
        );
    }

    private void logResponse(ServerWebExchange exchange, String requestId, long startTime) {
        ServerHttpResponse response = exchange.getResponse();
        HttpStatusCode statusCode = response.getStatusCode();

        long duration = System.currentTimeMillis() - startTime;
        int status = statusCode != null ? statusCode.value() : 0;
        String path = maskShareTokens(exchange.getRequest().getPath().toString());
        String contentLength = response.getHeaders().getFirst(HttpHeaders.CONTENT_LENGTH);

        log.info("[응답] 요청ID={} 상태코드={} 처리시간={}ms 경로={} 크기={}",
            requestId, status, duration, path, contentLength != null ? contentLength + "bytes" : "알수없음"
        );

        // 오류 응답 별도 로그
        if (status >= 400) {
            log.warn("[오류응답] 요청ID={} 상태코드={} 경로={} 처리시간={}ms 클라이언트IP={}",
                requestId, status, path, duration, getClientIp(exchange.getRequest())
            );
        }

        // 지연 요청 별도 로그
        if (duration > SLOW_REQUEST_THRESHOLD_MS) {
            log.warn("[지연요청] 요청ID={} 처리시간={}ms 임계값={}ms 경로={}",
                requestId, duration, SLOW_REQUEST_THRESHOLD_MS, path
            );
        }
    }

    /**
     * 일정 공유 토큰을 로그에서 지운다 (#627).
     *
     * <p>{@code /api/v1/shared-plans/{token}} 의 토큰은 <b>그 자체가 열람 권한</b>이다 — 인증 없이
     * 토큰만으로 남의 일정이 열린다. 이 필터가 요청 URI 와 응답 경로를 INFO 로 남기므로, 마스킹하지
     * 않으면 공유 토큰이 평문으로 Loki 에 쌓이고 로그를 볼 수 있는 사람은 누구나 그 일정을 열 수 있다.
     * 같은 필터가 {@code Authorization} 을 값 없이 <b>존재 여부만</b> 찍는 것과 같은 취지다.
     *
     * <p>가리는 것은 둘이다 — 접두어 바로 뒤 <b>한 세그먼트</b>와 쿼리스트링의 {@code token=} 값.
     * 그 밖(호스트·경로·다른 파라미터)은 그대로 남긴다. 어느 경로였는지는 로그에 남아야 장애를
     * 추적할 수 있다.
     *
     * <p><b>이 마스킹은 완결된 방어가 아니다.</b> 앞단 nginx access log 는 여전히 전체 경로를
     * 평문으로 남긴다 ({@code backend/docs/services/plan-service.md} 의 "남은 위험").
     */
    private String maskShareTokens(String uriOrPath) {
        return maskTokenQueryParameter(maskSharedPlanTokenSegment(uriOrPath));
    }

    private String maskTokenQueryParameter(String uriOrQuery) {
        return TOKEN_QUERY_PARAMETER.matcher(uriOrQuery).replaceAll(MASKED_TOKEN_QUERY_PARAMETER);
    }

    private String maskSharedPlanTokenSegment(String uriOrPath) {
        int prefixAt = uriOrPath.indexOf(SHARED_PLAN_PREFIX);
        if (prefixAt < 0) {
            return uriOrPath;
        }

        int tokenStart = prefixAt + SHARED_PLAN_PREFIX.length();
        int tokenEnd = tokenStart;
        while (tokenEnd < uriOrPath.length() && SEGMENT_TERMINATORS.indexOf(uriOrPath.charAt(tokenEnd)) < 0) {
            tokenEnd++;
        }
        if (tokenEnd == tokenStart) {
            return uriOrPath;
        }

        return uriOrPath.substring(0, tokenStart) + MASKED_SEGMENT + uriOrPath.substring(tokenEnd);
    }

    private String getClientIp(ServerHttpRequest request) {
        String forwardedFor = request.getHeaders().getFirst("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isEmpty()) {
            return forwardedFor.split(",")[0].trim();
        }

        String realIp = request.getHeaders().getFirst("X-Real-IP");
        if (realIp != null) {
            return realIp;
        }

        return request.getRemoteAddress() != null
            ? request.getRemoteAddress().getAddress().getHostAddress()
            : "알수없음";
    }

    private String getUserAgent(ServerHttpRequest request) {
        String userAgent = request.getHeaders().getFirst(HttpHeaders.USER_AGENT);
        if (userAgent == null) {
            return "알수없음";
        }

        // 너무 길면 자르기(Loki 수집용)
        return userAgent.length() > 100 ? userAgent.substring(0, 100) + "..." : userAgent;
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }
}
