package com.hondigagae.domainlayer.pet.adapter.out.client.support;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.pet.application.exception.PetErrorCode;
import com.hondigagae.domainlayer.pet.application.exception.PetException;
import feign.FeignException;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * pet 컨텍스트의 서비스 간 호출 지원 — 서킷 적용과 예외 변환 (#972).
 *
 * <p>이름에 컨텍스트 접두사를 붙인다. 다른 컨텍스트가 같은 단순 이름 {@code InternalResponseSupport} 를
 * 만들면 기본 빈 이름이 겹쳐 {@code ConflictingBeanDefinitionException} 으로 기동에 실패한다
 * (plan-service favorite / plan, 2026-09-03).
 */
@Component
@RequiredArgsConstructor
public class PetInternalResponseSupport {

    // 서킷브레이커 인스턴스명(application.yml resilience4j.circuitbreaker.instances 키와 일치).
    // Eureka 등록명(-dev/-prod 접미사)과 무관한 논리 서비스명을 쓴다.
    public static final String PLAN_SERVICE = "plan-service";

    private final CircuitBreakerRegistry circuitBreakerRegistry;

    /**
     * 서킷은 Feign 호출만 감싸 전송 실패(5xx·타임아웃)만 집계한다. 4xx 는 yml 의 ignore-exceptions 로
     * 집계에서 빠지지만 <b>호출 실패로는 본다</b> — 대상이 항상 200 으로 답하는 엔드포인트라, 404 는
     * "리소스 없음" 이 아니라 "경로가 없다"(상대가 아직 옛 버전으로 떠 있음)는 뜻이다.
     *
     * @throws PetException {@link PetErrorCode#INTERNAL_SERVICE_UNAVAILABLE} — 서킷 오픈·Feign 실패 전부.
     *         상위 계층으로 Feign·resilience4j 타입을 흘리지 않는다
     */
    public <T> T requestAndUnwrap(String targetService, Supplier<Response<T>> requester) {
        Response<T> response;
        try {
            response = circuitBreakerRegistry.circuitBreaker(targetService).executeSupplier(requester::get);
        } catch (CallNotPermittedException | FeignException exception) {
            throw new PetException(PetErrorCode.INTERNAL_SERVICE_UNAVAILABLE, exception);
        }
        return response == null ? null : response.dataBody();
    }
}
