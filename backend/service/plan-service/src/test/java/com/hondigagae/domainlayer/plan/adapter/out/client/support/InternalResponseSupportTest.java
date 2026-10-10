package com.hondigagae.domainlayer.plan.adapter.out.client.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.plan.application.exception.PlanErrorCode;
import com.hondigagae.domainlayer.plan.application.exception.PlanException;
import feign.FeignException;
import feign.Request;
import feign.RequestTemplate;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 내부 호출 두 메서드의 <b>계약 차이</b>를 고정한다.
 *
 * <p>같은 404 를 한쪽은 "리소스 없음"(null)으로, 다른 쪽은 "경로 없음"(503)으로 읽는다. 이 차이가
 * 무너지면 소유 검증이 조용히 바뀐다 — {@code findOwnedPetIds} 가 404 를 빈 집합으로 접으면
 * auth-service 가 그 엔드포인트 이전 버전으로 떠 있는 배포 창 동안 <b>정상 요청이 소유 위반으로
 * 둔갑</b>해 {@code PLAN_010}·{@code PLAN_011} 로 거짓 거절된다. 되돌려도 아무 테스트가 깨지지
 * 않으면 그 회귀는 배포 때까지 드러나지 않는다.
 */
class InternalResponseSupportTest {

    private final InternalResponseSupport support = new InternalResponseSupport(CircuitBreakerRegistry.ofDefaults());

    @Test
    @DisplayName("requestAndUnwrapOrNull 은 404 를 '리소스 없음' 으로 읽어 null 을 준다")
    void unwrapOrNullFoldsNotFoundIntoNull() {
        Object body = support.requestAndUnwrapOrNull(InternalResponseSupport.AUTH_SERVICE, throwing(notFound()));

        assertThat(body).isNull();
    }

    @Test
    @DisplayName("requestAndUnwrap 은 404 를 '경로 없음' 으로 읽어 503 으로 올린다")
    void unwrapTreatsNotFoundAsFailure() {
        assertThatThrownBy(() -> support.requestAndUnwrap(InternalResponseSupport.AUTH_SERVICE, throwing(notFound())))
            .isInstanceOf(PlanException.class)
            .extracting(exception -> ((PlanException) exception).getErrorCode())
            .isEqualTo(PlanErrorCode.INTERNAL_SERVICE_UNAVAILABLE);
    }

    @Test
    @DisplayName("404 가 아닌 전송 실패는 두 메서드 모두 503 으로 바꾼다 — FeignException 을 상위로 흘리지 않는다")
    void bothFoldOtherFeignFailuresIntoDomainException() {
        assertThatThrownBy(() -> support.requestAndUnwrapOrNull(InternalResponseSupport.AUTH_SERVICE, throwing(serverError())))
            .isInstanceOf(PlanException.class);
        assertThatThrownBy(() -> support.requestAndUnwrap(InternalResponseSupport.AUTH_SERVICE, throwing(serverError())))
            .isInstanceOf(PlanException.class);
    }

    @Test
    @DisplayName("정상 응답은 봉투를 벗겨 dataBody 만 돌려준다")
    void unwrapsTheResponseEnvelope() {
        List<String> data = List.of("몽실이");

        assertThat(support.requestAndUnwrap(InternalResponseSupport.AUTH_SERVICE, () -> Response.success(data)))
            .isEqualTo(data);
    }

    private static <T> Supplier<Response<T>> throwing(FeignException exception) {
        return () -> {
            throw exception;
        };
    }

    private static FeignException notFound() {
        return FeignException.errorStatus("PetConditionClient#getPetConditions(long,List)", feignResponse(404));
    }

    private static FeignException serverError() {
        return FeignException.errorStatus("PetConditionClient#getPetConditions(long,List)", feignResponse(500));
    }

    private static feign.Response feignResponse(int status) {
        Request request = Request.create(Request.HttpMethod.GET, "/internal/v1/pets/conditions",
            Map.of(), null, StandardCharsets.UTF_8, new RequestTemplate());
        return feign.Response.builder().status(status).reason("test").request(request).headers(Map.of()).build();
    }
}
