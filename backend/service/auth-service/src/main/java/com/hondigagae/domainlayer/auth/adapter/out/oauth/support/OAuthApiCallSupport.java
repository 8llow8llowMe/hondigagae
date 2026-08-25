package com.hondigagae.domainlayer.auth.adapter.out.oauth.support;

import com.hondigagae.domainlayer.auth.application.exception.AuthErrorCode;
import com.hondigagae.domainlayer.auth.application.exception.AuthException;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;

/**
 * 카카오 호출을 서킷브레이커로 감싸고, WebClient 예외를 도메인 예외로 변환한다.
 *
 * <p>인가코드 재사용/만료(4xx)는 사용자 조작(콜백 새로고침)으로 흔히 발생하므로 400으로,
 * provider 장애·타임아웃(5xx/네트워크)은 502로 구분해 500 스택 노출을 막는다.
 *
 * <p>4xx는 서킷 안에서 AuthException으로 변환되고, 설정의 ignore-exceptions에 의해
 * provider 장애로 집계되지 않는다. 5xx·타임아웃·커넥션 실패만 실패로 집계된다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OAuthApiCallSupport {

    // 서킷 인스턴스명(application.yml resilience4j.circuitbreaker.instances 키와 일치)
    private static final String CIRCUIT_NAME = "kakao";

    private final CircuitBreakerRegistry circuitBreakerRegistry;

    public <T> T call(Supplier<T> apiCall) {
        try {
            return circuitBreakerRegistry.circuitBreaker(CIRCUIT_NAME).executeSupplier(() -> {
                try {
                    return apiCall.get();
                } catch (WebClientResponseException e) {
                    if (e.getStatusCode().is4xxClientError()) {
                        log.warn("[OAuthApiCall] 카카오 응답 오류: status={}, body={}",
                            e.getStatusCode(), e.getResponseBodyAsString());
                        throw new AuthException(AuthErrorCode.OAUTH_AUTHORIZATION_FAILED);
                    }
                    throw e;
                }
            });
        } catch (CallNotPermittedException e) {
            log.warn("[OAuthApiCall] 서킷 오픈으로 호출 차단");
            throw new AuthException(AuthErrorCode.OAUTH_PROVIDER_UNAVAILABLE);
        } catch (WebClientResponseException e) {
            log.warn("[OAuthApiCall] 카카오 응답 오류: status={}, body={}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new AuthException(AuthErrorCode.OAUTH_PROVIDER_UNAVAILABLE);
        } catch (WebClientRequestException e) {
            log.error("[OAuthApiCall] 카카오 통신 실패: error={}", e.getMessage());
            throw new AuthException(AuthErrorCode.OAUTH_PROVIDER_UNAVAILABLE);
        }
    }
}
