package com.hondigagae.domainlayer.pet.adapter.out.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.pet.adapter.out.client.feign.PlanCompanionClient;
import com.hondigagae.domainlayer.pet.adapter.out.client.feign.dto.PlanCompanionReconcileClientResponse;
import com.hondigagae.domainlayer.pet.adapter.out.client.support.PetInternalResponseSupport;
import com.hondigagae.domainlayer.pet.application.exception.PetErrorCode;
import com.hondigagae.domainlayer.pet.application.exception.PetException;
import feign.FeignException;
import feign.Request;
import feign.RequestTemplate;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 반려견 삭제 트리거 어댑터 (#972) — <b>어떤 실패에도 던지지 않는다</b>.
 *
 * <p>삭제는 이미 커밋된 뒤라, 여기서 예외가 새면 사용자는 "삭제 실패" 를 보는데 반려견은 실제로 지워진
 * 상태가 된다. 서킷 오픈·5xx·404(옛 버전의 plan) 전부 경고 로그로 끝나고, 못 한 몫은 04:10 배치가 잇는다.
 */
class PlanCompanionClientAdapterTest {

    private static final long MEMBER_ID = 1L;
    private static final long PET_ID = 10L;

    private CircuitBreakerRegistry circuitBreakerRegistry;
    private StubPlanCompanionClient client;
    private PlanCompanionClientAdapter adapter;

    @BeforeEach
    void setUp() {
        circuitBreakerRegistry = CircuitBreakerRegistry.ofDefaults();
        client = new StubPlanCompanionClient();
        adapter = new PlanCompanionClientAdapter(client, new PetInternalResponseSupport(circuitBreakerRegistry));
    }

    @Test
    @DisplayName("정상 응답이면 회원 아이디로 한 번 요청하고 조용히 돌아온다")
    void requestsOnceWithTheMemberId() {
        client.response = Response.success(new PlanCompanionReconcileClientResponse(2, 1, 0));

        assertThatCode(() -> adapter.reconcileCompanions(MEMBER_ID, PET_ID)).doesNotThrowAnyException();

        assertThat(client.requestedMemberIds).containsExactly(MEMBER_ID);
    }

    @Test
    @DisplayName("plan-service 가 503 이면 던지지 않는다")
    void swallowsServiceUnavailable() {
        client.failure = feignError(503);

        assertThatCode(() -> adapter.reconcileCompanions(MEMBER_ID, PET_ID)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("404(엔드포인트가 없는 옛 버전의 plan)도 실패로 보고 던지지 않는다")
    void swallowsNotFound() {
        client.failure = feignError(404);

        assertThatCode(() -> adapter.reconcileCompanions(MEMBER_ID, PET_ID)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("서킷이 열려 있으면 호출하지 않고, 던지지도 않는다")
    void swallowsOpenCircuitWithoutCalling() {
        circuitBreakerRegistry.circuitBreaker(PetInternalResponseSupport.PLAN_SERVICE).transitionToOpenState();

        assertThatCode(() -> adapter.reconcileCompanions(MEMBER_ID, PET_ID)).doesNotThrowAnyException();

        assertThat(client.requestedMemberIds).isEmpty();
    }

    @Test
    @DisplayName("봉투 없는 빈 응답이어도 던지지 않는다")
    void toleratesEmptyBody() {
        client.response = null;

        assertThatCode(() -> adapter.reconcileCompanions(MEMBER_ID, PET_ID)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("support 는 Feign 실패를 PET_005 로 바꾼다 — Feign 타입을 상위로 흘리지 않는다")
    void supportFoldsFeignFailuresIntoPetException() {
        PetInternalResponseSupport support = new PetInternalResponseSupport(circuitBreakerRegistry);

        assertThatThrownBy(() -> support.requestAndUnwrap(PetInternalResponseSupport.PLAN_SERVICE, () -> {
            throw feignError(500);
        }))
            .isInstanceOf(PetException.class)
            .extracting(exception -> ((PetException) exception).getErrorCode())
            .isEqualTo(PetErrorCode.INTERNAL_SERVICE_UNAVAILABLE);
    }

    private static FeignException feignError(int status) {
        Request request = Request.create(Request.HttpMethod.POST, "/internal/v1/plans/companions/reconcile",
            Map.of(), null, StandardCharsets.UTF_8, new RequestTemplate());
        feign.Response response = feign.Response.builder().status(status).reason("test").request(request).headers(Map.of()).build();
        return FeignException.errorStatus("PlanCompanionClient#reconcileCompanions(long)", response);
    }

    private static final class StubPlanCompanionClient implements PlanCompanionClient {

        private final List<Long> requestedMemberIds = new ArrayList<>();
        private Response<PlanCompanionReconcileClientResponse> response;
        private FeignException failure;

        @Override
        public Response<PlanCompanionReconcileClientResponse> reconcileCompanions(long memberId) {
            requestedMemberIds.add(memberId);
            if (failure != null) {
                throw failure;
            }
            return response;
        }
    }
}
