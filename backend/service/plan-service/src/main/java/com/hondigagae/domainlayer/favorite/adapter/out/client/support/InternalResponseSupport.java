package com.hondigagae.domainlayer.favorite.adapter.out.client.support;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.favorite.application.exception.FavoriteErrorCode;
import com.hondigagae.domainlayer.favorite.application.exception.FavoriteException;
import feign.FeignException;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * favorite 컨텍스트의 내부 서비스 호출 서킷 적용·예외 변환 (coding-conventions §10).
 *
 * <p>plan 컨텍스트의 support 와 같은 패턴이지만 도메인 예외 타입이 달라 컨텍스트별로 둔다 —
 * 서킷 인스턴스명은 논리 서비스명으로 같아, 같은 원격 서비스의 장애는 하나의 서킷으로 집계된다.
 */
@Component
@RequiredArgsConstructor
public class InternalResponseSupport {

    // 서킷브레이커 인스턴스명(application.yml resilience4j.circuitbreaker.instances 키와 일치).
    public static final String TOUR_SERVICE = "tour-service";

    private final CircuitBreakerRegistry circuitBreakerRegistry;

    /**
     * 서킷은 전송 실패(5xx·타임아웃)만 집계하도록 Feign 호출만 감싼다.
     * 404 는 대상 리소스 없음으로 보고 null 을 반환해 어댑터의 도메인 판단에 맡긴다.
     */
    public <T> T requestAndUnwrapOrNull(String targetService, Supplier<Response<T>> requester) {
        Response<T> response;
        try {
            response = circuitBreakerRegistry.circuitBreaker(targetService).executeSupplier(requester::get);
        } catch (FeignException.NotFound exception) {
            return null;
        } catch (CallNotPermittedException | FeignException exception) {
            throw new FavoriteException(FavoriteErrorCode.INTERNAL_SERVICE_UNAVAILABLE, exception);
        }
        return response == null ? null : response.dataBody();
    }
}
