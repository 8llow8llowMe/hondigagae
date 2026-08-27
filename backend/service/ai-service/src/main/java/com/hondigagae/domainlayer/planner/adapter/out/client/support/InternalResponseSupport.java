package com.hondigagae.domainlayer.planner.adapter.out.client.support;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanErrorCode;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanException;
import feign.FeignException;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 내부 서비스 호출의 서킷 적용과 예외 변환 (coding-conventions §10).
 *
 * <p>Feign 예외가 application 계층이나 web advice 까지 새어나가지 않게 여기서 도메인 예외로 바꾼다.
 */
@Component
@RequiredArgsConstructor
public class InternalResponseSupport {

    // 서킷 인스턴스명. Eureka 등록명(-dev/-prod 접미사)과 무관한 논리 서비스명을 쓴다.
    public static final String TOUR_SERVICE = "tour-service";

    private final CircuitBreakerRegistry circuitBreakerRegistry;

    /**
     * 서킷은 전송 실패(5xx/타임아웃)만 집계하도록 Feign 호출만 감싼다.
     * 404 는 대상 리소스 없음으로 보고 null 을 반환해 어댑터의 도메인 판단에 맡긴다.
     */
    public <T> T requestAndUnwrapOrNull(String targetService, Supplier<Response<T>> requester) {
        Response<T> response;
        try {
            response = circuitBreakerRegistry.circuitBreaker(targetService).executeSupplier(requester::get);
        } catch (FeignException.NotFound exception) {
            return null;
        } catch (CallNotPermittedException | FeignException exception) {
            throw new AiPlanException(AiPlanErrorCode.INTERNAL_SERVICE_UNAVAILABLE, exception);
        }
        return response == null ? null : response.dataBody();
    }
}
