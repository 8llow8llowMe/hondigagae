package com.hondigagae.apigateway.filter;

import com.hondigagae.apigateway.filter.JwtAuthApiGatewayFilter.Config;
import com.hondigagae.apigateway.jwt.AccessTokenBlacklistChecker;
import com.hondigagae.apigateway.jwt.JwtVerifier;
import com.hondigagae.apigateway.jwt.exception.JwtErrorCode;
import com.hondigagae.apigateway.jwt.exception.JwtException;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.security.SecurityException;
import io.jsonwebtoken.security.SignatureException;
import lombok.RequiredArgsConstructor;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.factory.AbstractGatewayFilterFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

@Component
@RequiredArgsConstructor
public class JwtAuthApiGatewayFilter extends AbstractGatewayFilterFactory<Config> {

    private static final String BEARER_PREFIX = "Bearer ";
    private static final String MEMBER_ID_HEADER = "X-Authenticated-Member-Id";
    private static final String LEGACY_MEMBER_ID_HEADER = "X-Member-Id";

    private final JwtVerifier jwtVerifier;
    private final AccessTokenBlacklistChecker accessTokenBlacklistChecker;

    @Override
    public GatewayFilter apply(Config config) {
        return (exchange, chain) -> {
            ServerHttpRequest sanitizedRequest = sanitizeHeaders(exchange.getRequest());
            String jwt = getJwtFrom(sanitizedRequest);

            if (!StringUtils.hasText(jwt)) {
                return chain.filter(exchange.mutate().request(sanitizedRequest).build());
            }

            return Mono.defer(() -> {
                Claims claims = verify(jwt);
                return rejectIfRevoked(claims.getId())
                    .then(Mono.defer(() -> {
                        ServerHttpRequest authenticatedRequest = addMemberIdHeader(sanitizedRequest, claims);
                        return chain.filter(exchange.mutate().request(authenticatedRequest).build());
                    }));
            });
        };
    }

    /** 서명·만료·형식 검증. 메모리 안의 계산이라 호출 스레드(이벤트 루프)에서 그대로 한다. */
    private Claims verify(String jwt) {
        try {
            return jwtVerifier.validateAndGetClaims(jwt);
        } catch (ExpiredJwtException e) {
            throw new JwtException(JwtErrorCode.TOKEN_EXPIRED);
        } catch (SignatureException e) {
            throw new JwtException(JwtErrorCode.TOKEN_SIGNATURE_INVALID);
        } catch (MalformedJwtException e) {
            throw new JwtException(JwtErrorCode.TOKEN_MALFORMED);
        } catch (SecurityException | IllegalArgumentException e) {
            throw new JwtException(JwtErrorCode.TOKEN_INVALID);
        }
    }

    /**
     * 로그아웃된 토큰이면 {@code TOKEN_REVOKED} 로 끝낸다. jti 가 없는 토큰은 확인하지 않는다(종전과 같다).
     *
     * <p><b>Redis 확인은 {@code boundedElastic} 에서 한다 (#1253).</b> {@link AccessTokenBlacklistChecker} 는 블로킹
     * {@code RedisTemplate} 을 부르는데, 이 필터는 Netty 이벤트 루프 위에서 돈다. 이벤트 루프 스레드는 코어 수만큼밖에
     * 없고 한 스레드가 수많은 연결을 맡으므로, Redis 가 먹통인 동안 한 요청이 명령 타임아웃만큼 루프를 붙잡으면
     * <b>그 루프에 걸린 다른 요청 — 토큰이 없는 공개 API 까지 — 이 함께 멈춘다.</b> 예전에는 그 시간이 60초였다.
     *
     * <p>리액티브 템플릿으로 바꾸지 않고 스레드만 옮겼다. 판정기와 그 예외 규칙(연결 실패 · 명령 타임아웃 →
     * fail-closed 503 또는 fail-open 통과)을 그대로 두면 판정 결과 · 예외 매핑 · 응답이 바뀌지 않는다. 리액티브 템플릿도
     * 완전히 논블로킹은 아니다 — 동기 · 리액티브 공유 연결은 연결 팩토리의 <b>락 하나</b> 아래에서 호출 스레드가 처음
     * 동기로 connect 한다. 그래서 같은 락을 거치는 레이트 리밋 판정도 이벤트 루프 밖에서 구독한다
     * ({@code SharedPlanRateLimitGatewayFilterFactory#decide}). 기동 시점부터 Redis 가 먹통이면 첫 연결 시도들이 그 락에서
     * 줄을 서지만, 그 대기는 {@code boundedElastic} 쪽에서만 일어난다.
     *
     * <p>판정이 끝나면 체인은 그 스레드에서 이어지고, 업스트림 전송은 Reactor Netty 가 제 이벤트 루프로 넘긴다.
     * {@code boundedElastic} 은 스레드 수에 상한(코어 × 10)이 있어 Redis 장애 중 동시에 기다리는 확인도 그만큼으로
     * 묶이고 나머지는 큐에서 기다린다 — 루프가 멈추는 것보다 낫고, 한 번 기다리는 길이는 명령 타임아웃이 정한다.
     */
    private Mono<Void> rejectIfRevoked(String tokenId) {
        if (tokenId == null) {
            return Mono.empty();
        }
        return Mono.fromCallable(() -> accessTokenBlacklistChecker.isBlacklisted(tokenId))
            .subscribeOn(Schedulers.boundedElastic())
            .flatMap(revoked -> revoked ? Mono.error(new JwtException(JwtErrorCode.TOKEN_REVOKED)) : Mono.empty());
    }

    /**
     * 인증 스킴은 <b>대소문자를 가리지 않고</b> 읽는다 (#1261, RFC 7235). 하류 서비스(resource server 의
     * {@code DefaultBearerTokenResolver})가 {@code bearer} · {@code BEARER} 도 인증하는데 여기서만 가리면,
     * 소문자 스킴의 토큰을 "토큰 없음" 으로 보고 블랙리스트 확인을 건너뛴 채 넘긴다 — 로그아웃한 토큰이 남은 수명
     * 동안 통했다. 두 쪽이 같은 요청을 같은 토큰으로 읽어야 게이트웨이의 폐기 판정이 하류 인증 앞에 선다.
     */
    private String getJwtFrom(ServerHttpRequest request) {
        String bearerToken = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (StringUtils.hasText(bearerToken) && bearerToken.regionMatches(true, 0, BEARER_PREFIX, 0, BEARER_PREFIX.length())) {
            return bearerToken.substring(BEARER_PREFIX.length());
        }
        return null;
    }

    private ServerHttpRequest sanitizeHeaders(ServerHttpRequest request) {
        return request.mutate()
            .headers(headers -> {
                headers.remove(MEMBER_ID_HEADER);
                headers.remove(LEGACY_MEMBER_ID_HEADER);
            })
            .build();
    }

    private ServerHttpRequest addMemberIdHeader(ServerHttpRequest request, Claims claims) {
        String memberId = claims.getSubject();
        if (!StringUtils.hasText(memberId)) {
            return request;
        }
        return request.mutate()
            .header(MEMBER_ID_HEADER, memberId)
            .build();
    }

    public static class Config {

    }
}
