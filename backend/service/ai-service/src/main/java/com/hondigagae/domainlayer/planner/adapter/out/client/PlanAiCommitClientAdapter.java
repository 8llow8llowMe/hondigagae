package com.hondigagae.domainlayer.planner.adapter.out.client;

import com.hondigagae.domainlayer.planner.adapter.out.client.feign.PlanAiCommitClient;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto.PlanAiCommitClientResponse;
import com.hondigagae.domainlayer.planner.adapter.out.client.support.InternalResponseSupport;
import com.hondigagae.domainlayer.planner.application.exception.AiPlanException;
import com.hondigagae.domainlayer.planner.application.port.out.PlanAiCommitQueryPort;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * AI 담기 조회 어댑터 (#970).
 *
 * <p>같은 plan-service 를 부르는 {@link PlanOutlineClientAdapter} 와 <b>반대로 실패를 삼킨다.</b>
 * 재생성의 일정 개요는 없으면 진행할 수 없는 필수 입력이라 503 을 그대로 올리지만, 담은 일정 아이디는
 * 잡 조회에 덧붙이는 표시일 뿐이다. 서킷 오픈·5xx·타임아웃({@code InternalResponseSupport} 가
 * {@code AIPLAN_009} 로 바꾼 것)에서 던지면 plan-service 한 번 흔들림에 초안 조회(폴링)가 503 이 되고
 * SSE 는 구독 콜백이 예외를 삼켜 종결 이벤트를 영영 못 보낸다. 비어 있어도 안전하다 — 화면이 담기를
 * 다시 눌러도 plan-service 의 멱등 키가 같은 일정을 돌려준다. 반려견 특성 어댑터와 같은 관용 원칙이다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PlanAiCommitClientAdapter implements PlanAiCommitQueryPort {

    private final PlanAiCommitClient planAiCommitClient;
    private final InternalResponseSupport internalResponseSupport;

    @Override
    public Optional<Long> findCommittedPlanId(long memberId, String jobId) {
        try {
            PlanAiCommitClientResponse body = internalResponseSupport.requestAndUnwrapOrNull(
                InternalResponseSupport.PLAN_SERVICE, () -> planAiCommitClient.getAiCommit(jobId, memberId));
            return body == null ? Optional.empty() : Optional.ofNullable(body.planId());
        } catch (AiPlanException exception) {
            log.warn("Plan ai commit lookup failed jobId={} memberId={} errorCode={}",
                jobId, memberId, exception.getErrorCode().getCode());
            return Optional.empty();
        }
    }
}
