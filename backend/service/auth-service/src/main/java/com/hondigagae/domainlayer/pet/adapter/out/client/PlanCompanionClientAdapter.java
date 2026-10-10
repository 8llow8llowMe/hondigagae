package com.hondigagae.domainlayer.pet.adapter.out.client;

import com.hondigagae.domainlayer.pet.adapter.out.client.feign.PlanCompanionClient;
import com.hondigagae.domainlayer.pet.adapter.out.client.feign.dto.PlanCompanionReconcileClientResponse;
import com.hondigagae.domainlayer.pet.adapter.out.client.support.PetInternalResponseSupport;
import com.hondigagae.domainlayer.pet.application.exception.PetException;
import com.hondigagae.domainlayer.pet.application.port.out.PlanCompanionCommandPort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 반려견 삭제 직후 plan-service 에 동행 목록 대사를 요청한다 (#972).
 *
 * <p><b>실패를 삼킨다.</b> 이 호출은 삭제의 일부가 아니라 뒤따르는 정리다 — 삭제는 이미 커밋됐고,
 * 여기서 예외를 올리면 사용자는 "삭제 실패" 를 보지만 반려견은 실제로 지워진 상태가 된다. 못 한 몫은
 * plan-service 의 04:10 대사 배치가 같은 로직으로 이어받는다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PlanCompanionClientAdapter implements PlanCompanionCommandPort {

    private final PlanCompanionClient planCompanionClient;
    private final PetInternalResponseSupport petInternalResponseSupport;

    @Override
    public void reconcileCompanions(long memberId, long deletedPetId) {
        try {
            PlanCompanionReconcileClientResponse body = petInternalResponseSupport.requestAndUnwrap(
                PetInternalResponseSupport.PLAN_SERVICE, () -> planCompanionClient.reconcileCompanions(memberId));
            if (body == null) {
                log.info("Plan companion reconcile requested memberId={} deletedPetId={} result=empty", memberId, deletedPetId);
                return;
            }
            log.info("Plan companion reconcile requested memberId={} deletedPetId={} detached={} representativeChanged={} placeholderKept={}",
                memberId, deletedPetId, body.detached(), body.representativeChanged(), body.placeholderKept());
        } catch (PetException exception) {
            // 원인(서킷 오픈·타임아웃·5xx·404)은 cause 에 있다. 스택까지 남겨 어느 쪽인지 로그로 가른다.
            log.warn("Plan companion reconcile request failed; the 04:10 reconcile batch will pick it up. "
                + "memberId={} deletedPetId={} errorCode={}", memberId, deletedPetId, exception.getErrorCode().getCode(), exception);
        } catch (RuntimeException exception) {
            // 응답 역직렬화 실패 같은 예상 밖 오류도 삭제 응답을 깨뜨리지 않는다 — 포트 계약은 "던지지 않는다" 다.
            log.warn("Plan companion reconcile request failed unexpectedly; the 04:10 reconcile batch will pick it up. "
                + "memberId={} deletedPetId={}", memberId, deletedPetId, exception);
        }
    }
}
