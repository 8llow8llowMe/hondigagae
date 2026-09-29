package com.hondigagae.domainlayer.planner.adapter.out.client;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.PlanAiCommitClient;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto.PlanAiCommitClientResponse;
import com.hondigagae.domainlayer.planner.adapter.out.client.support.InternalResponseSupport;
import feign.FeignException;
import feign.Request;
import feign.RetryableException;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * AI 담기 조회 어댑터 (#970).
 *
 * <p>같은 plan-service 를 부르는 일정 개요 어댑터는 실패를 503 으로 올리지만 이 어댑터는 <b>반대로 삼킨다.</b>
 * 여기서 던지면 plan-service 한 번 흔들림에 초안 조회가 503 이 되고 SSE 는 종결 이벤트를 못 보낸다.
 * 누가 "같은 plan-service 니까" 하고 개요 어댑터와 모양을 맞추면 여기서 깨진다.
 */
class PlanAiCommitClientAdapterTest {

    private static final long MEMBER_ID = 7L;
    private static final String JOB_ID = "8a64f9c0-2f1e-4c1a-9c3e-9f2b6a7d1e00";

    private final CircuitBreakerRegistry registry = CircuitBreakerRegistry.ofDefaults();

    @Test
    @DisplayName("담은 일정이 있으면 그 아이디를 돌려준다")
    void returnsPlanIdWhenCommitted() {
        PlanAiCommitClientAdapter adapter = adapter((jobId, memberId) ->
            Response.success(new PlanAiCommitClientResponse(1234567890123456789L)));

        assertThat(adapter.findCommittedPlanId(MEMBER_ID, JOB_ID)).contains(1234567890123456789L);
    }

    @Test
    @DisplayName("담은 적이 없으면(200 + planId null) 비어 있다")
    void returnsEmptyWhenNotCommitted() {
        PlanAiCommitClientAdapter adapter = adapter((jobId, memberId) -> Response.success(new PlanAiCommitClientResponse(null)));

        assertThat(adapter.findCommittedPlanId(MEMBER_ID, JOB_ID)).isEmpty();
    }

    @Test
    @DisplayName("jobId 와 memberId 를 그대로 넘긴다 — plan 쪽이 memberId 로 소유를 거른다")
    void passesJobIdAndMemberId() {
        String[] seenJobId = new String[1];
        long[] seenMemberId = new long[1];
        PlanAiCommitClientAdapter adapter = adapter((jobId, memberId) -> {
            seenJobId[0] = jobId;
            seenMemberId[0] = memberId;
            return Response.success(new PlanAiCommitClientResponse(null));
        });

        adapter.findCommittedPlanId(MEMBER_ID, JOB_ID);

        assertThat(seenJobId[0]).isEqualTo(JOB_ID);
        assertThat(seenMemberId[0]).isEqualTo(MEMBER_ID);
    }

    @Test
    @DisplayName("본문이 비어 있어도 비어 있다")
    void returnsEmptyWhenBodyMissing() {
        PlanAiCommitClientAdapter adapter = adapter((jobId, memberId) -> Response.success(null));

        assertThat(adapter.findCommittedPlanId(MEMBER_ID, JOB_ID)).isEmpty();
    }

    @Test
    @DisplayName("5xx 는 던지지 않고 비어 있다")
    void swallowsServerError() {
        PlanAiCommitClientAdapter adapter = adapter((jobId, memberId) -> {
            throw new FeignException.InternalServerError("boom", request(), null, Map.of());
        });

        assertThat(adapter.findCommittedPlanId(MEMBER_ID, JOB_ID)).isEmpty();
    }

    @Test
    @DisplayName("타임아웃(RetryableException)도 던지지 않고 비어 있다")
    void swallowsTimeout() {
        PlanAiCommitClientAdapter adapter = adapter((jobId, memberId) -> {
            throw new RetryableException(-1, "Read timed out", Request.HttpMethod.GET, (Long) null, request());
        });

        assertThat(adapter.findCommittedPlanId(MEMBER_ID, JOB_ID)).isEmpty();
    }

    @Test
    @DisplayName("404 도 비어 있다 — 옛 plan-service 처럼 경로가 없을 때")
    void treatsNotFoundAsEmpty() {
        PlanAiCommitClientAdapter adapter = adapter((jobId, memberId) -> {
            throw new FeignException.NotFound("missing", request(), null, Map.of());
        });

        assertThat(adapter.findCommittedPlanId(MEMBER_ID, JOB_ID)).isEmpty();
    }

    @Test
    @DisplayName("서킷이 열려 있으면(CallNotPermitted) 호출하지 않고 비어 있다")
    void swallowsOpenCircuit() {
        registry.circuitBreaker(InternalResponseSupport.PLAN_SERVICE).transitionToForcedOpenState();
        AtomicInteger calls = new AtomicInteger();
        PlanAiCommitClientAdapter adapter = adapter((jobId, memberId) -> {
            calls.incrementAndGet();
            return Response.success(new PlanAiCommitClientResponse(1L));
        });

        assertThat(adapter.findCommittedPlanId(MEMBER_ID, JOB_ID)).isEmpty();
        assertThat(calls).hasValue(0);
    }

    private PlanAiCommitClientAdapter adapter(PlanAiCommitClient client) {
        return new PlanAiCommitClientAdapter(client, new InternalResponseSupport(registry));
    }

    private static Request request() {
        return Request.create(Request.HttpMethod.GET, "http://plan-service/internal/v1/plans/ai-commits/" + JOB_ID,
            Map.of(), null, StandardCharsets.UTF_8, null);
    }
}
