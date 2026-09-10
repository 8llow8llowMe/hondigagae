package com.hondigagae.domainlayer.plan.adapter.out.client.support;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.plan.application.exception.PlanErrorCode;
import com.hondigagae.domainlayer.plan.application.exception.PlanException;
import feign.FeignException;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class InternalResponseSupport {

    // 서킷브레이커 인스턴스명(application.yml resilience4j.circuitbreaker.instances 키와 일치).
    // Eureka 등록명(-dev/-prod 접미사)과 무관한 논리 서비스명을 쓴다.
    public static final String TOUR_SERVICE = "tour-service";
    public static final String AUTH_SERVICE = "auth-service";

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
            throw new PlanException(PlanErrorCode.INTERNAL_SERVICE_UNAVAILABLE, exception);
        }
        return response == null ? null : response.dataBody();
    }

    /**
     * {@link #requestAndUnwrapOrNull} 과 같되 <b>404 도 실패로 본다.</b>
     *
     * <p>"리소스 없음" 이 정상 응답인 호출(장소 조회 등)에는 쓰지 않는다. 대상이 <b>항상 200 으로
     * 답하는 엔드포인트</b>(없으면 {@code dataBody} null)일 때만 쓴다 — 그런 곳의 404 는 리소스가
     * 없다는 뜻이 아니라 <b>경로가 없다는 뜻</b>이다(상대 서비스가 아직 그 엔드포인트가 없는
     * 옛 버전으로 떠 있을 때). 그것을 null 로 접으면 배포 순서가 어긋난 동안 "특보 없음" 같은
     * 거짓 정상이 화면에 나간다.
     */
    public <T> T requestAndUnwrap(String targetService, Supplier<Response<T>> requester) {
        Response<T> response;
        try {
            response = circuitBreakerRegistry.circuitBreaker(targetService).executeSupplier(requester::get);
        } catch (CallNotPermittedException | FeignException exception) {
            throw new PlanException(PlanErrorCode.INTERNAL_SERVICE_UNAVAILABLE, exception);
        }
        return response == null ? null : response.dataBody();
    }
}
