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
                try {
                    Claims claims = jwtVerifier.validateAndGetClaims(jwt);
                    String tokenId = claims.getId();
                    if (tokenId != null && accessTokenBlacklistChecker.isBlacklisted(tokenId)) {
                        throw new JwtException(JwtErrorCode.TOKEN_REVOKED);
                    }

                    ServerHttpRequest authenticatedRequest = addMemberIdHeader(sanitizedRequest, claims);
                    return chain.filter(exchange.mutate().request(authenticatedRequest).build());
                } catch (JwtException e) {
                    throw e;
                } catch (ExpiredJwtException e) {
                    throw new JwtException(JwtErrorCode.TOKEN_EXPIRED);
                } catch (SignatureException e) {
                    throw new JwtException(JwtErrorCode.TOKEN_SIGNATURE_INVALID);
                } catch (MalformedJwtException e) {
                    throw new JwtException(JwtErrorCode.TOKEN_MALFORMED);
                } catch (SecurityException | IllegalArgumentException e) {
                    throw new JwtException(JwtErrorCode.TOKEN_INVALID);
                }
            });
        };
    }

    private String getJwtFrom(ServerHttpRequest request) {
        String bearerToken = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith(BEARER_PREFIX)) {
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
