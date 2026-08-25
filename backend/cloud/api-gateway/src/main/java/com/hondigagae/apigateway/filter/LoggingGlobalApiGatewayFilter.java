package com.hondigagae.apigateway.filter;

import java.util.UUID;
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

        log.info("[요청] 요청ID={} 메서드={} URI={} 클라이언트IP={} UserAgent={} 인증헤더존재={} 쿼리={}",
            requestId, request.getMethod(), request.getURI(), getClientIp(request),
            getUserAgent(request), request.getHeaders().containsKey(HttpHeaders.AUTHORIZATION),
            request.getURI().getQuery() != null ? request.getURI().getQuery() : "없음"
        );
    }

    private void logResponse(ServerWebExchange exchange, String requestId, long startTime) {
        ServerHttpResponse response = exchange.getResponse();
        HttpStatusCode statusCode = response.getStatusCode();

        long duration = System.currentTimeMillis() - startTime;
        int status = statusCode != null ? statusCode.value() : 0;
        String path = exchange.getRequest().getPath().toString();
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
