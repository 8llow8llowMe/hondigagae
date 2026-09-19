package com.hondigagae.domainlayer.plan.application.service.processor;

import com.hondigagae.domainlayer.plan.application.model.PlanCompanionReconcileCounts;
import com.hondigagae.domainlayer.plan.application.port.out.PlanPetRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanRepositoryPort;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import com.hondigagae.domainlayer.plan.domain.model.PlanPet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 삭제된 반려견을 일정의 동행 목록에서 떼어낸다 (#720).
 *
 * <p>반려견은 auth-service 에서 <b>소프트 삭제</b>(deleted=true)되고, 일정은 plan-service DB 에
 * 있다. 스키마가 갈라져 있어 FK 로 강제할 수 없으므로 {@code plan_pet} 에 죽은 반려견 행이
 * 남고, 일정 상세 {@code petIds} 가 지워진 아이를 계속 내려보낸다.
 *
 * <h4>지키는 규칙 셋</h4>
 * <ol>
 *   <li><b>완료 일정은 불가침</b> — 대상 조회가 {@code DRAFT}·{@code CONFIRMED} 만 본다. 완료된
 *       일정의 동행견은 사용자도 바꿀 수 없고({@code PLAN_019}) 배치도 바꾸지 않는다.
 *       완료 시점 스냅샷({@code plan_pet_condition})은 <b>이 처리의 대상이 아니다</b> —
 *       그 테이블은 "프로필이 삭제돼도 유지" 가 존재 이유다</li>
 *   <li><b>대표 승계</b> — 지운 뒤 남은 {@code plan_pet} 행 중 id 가 가장 작은(= 먼저 저장된)
 *       아이를 {@code plan.pet_id} 로 올린다. auth 의 대표 반려견 승계와 같은 모양이다.
 *       행 삭제와 대표 갱신은 <b>같은 트랜잭션</b>이어야 "pet_id = plan_pet 첫 행" 이 깨지지 않는다</li>
 *   <li><b>마지막 한 마리는 떼어내지 않는다</b> — 정리 후 0마리가 될 일정이면 그 아이를 자리
 *       표시자로 남긴다. {@code plan.pet_id} 는 NOT NULL 이고 "일정에 최소 한 마리" 는 생성·수정
 *       경로가 {@code PLAN_010} 으로 지키는 불변식이다. 배치가 그걸 뒤에서 깨면 안 된다</li>
 * </ol>
 *
 * <p><b>왜 {@code @Transactional} 이 아니라 {@link TransactionTemplate} 인가</b> — 트랜잭션
 * 경계가 <b>일정 하나</b>다. 회차 전체나 반려견 하나를 한 트랜잭션으로 묶으면 일정 하나가
 * 실패할 때 이미 정리한 일정까지 함께 롤백된다. 그런데 루프와 일정 단위 처리가 같은 클래스에
 * 있으면 {@code @Transactional} 은 <b>자기 호출이라 프록시를 타지 않아</b> 경계가 조용히
 * 사라진다 — 그러면 행 삭제와 대표 갱신이 서로 다른 트랜잭션으로 나뉜다. 템플릿은 그 함정이 없다.
 *
 * <p><b>동시 실행은 일정 행 비관 잠금으로 직렬화된다.</b> 여러 인스턴스가 같은 시각에 돌아도
 * 안전한 이유는 "멱등이니까" 가 아니다 — 죽은 아이가 둘 실린 일정을 두 실행이 나눠 지우면
 * 동행견 0마리가 만들어지고, 그건 멱등으로 덮이지 않는다. 트랜잭션 안의 재조회가 일정 행을
 * 잠그기 때문에 뒤에 온 쪽이 앞 실행의 결과를 보고 R3 로 남긴다.
 *
 * <p><b>잠금 순서는 {@code plan} → {@code plan_pet} 이고, 사용자 수정 경로도 같다</b>
 * ({@code PlanCommandProcessor.updatePlan}). 순서가 갈리면 새벽 배치와 그 시각에 동행견을 고치던
 * 사용자가 서로를 기다리다 데드락이 나고, 피해자가 되는 쪽은 사용자다(500). 한쪽 순서를 바꿀 때는
 * 반드시 다른 쪽도 같이 본다.
 */
@Slf4j
@Component
public class PlanPetDetachProcessor {

    private final PlanRepositoryPort planRepositoryPort;
    private final PlanPetRepositoryPort planPetRepositoryPort;
    private final TransactionTemplate transactionTemplate;

    public PlanPetDetachProcessor(PlanRepositoryPort planRepositoryPort, PlanPetRepositoryPort planPetRepositoryPort,
        PlatformTransactionManager transactionManager
    ) {
        this.planRepositoryPort = planRepositoryPort;
        this.planPetRepositoryPort = planPetRepositoryPort;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    /**
     * 회원 한 명의 일정에서 죽은 반려견 하나를 떼어낸다.
     *
     * <p>일정 하나가 실패해도 나머지는 계속 처리한다. 대사는 재실행이 안전한(멱등) 작업이라
     * 부분 진행이 문제가 되지 않는다 — 실패한 일정은 다음 회차가 다시 만난다.
     */
    public PlanCompanionReconcileCounts detachPet(long memberId, long petId) {
        List<Plan> targets = planRepositoryPort.findCompanionEditablePlansWithPet(memberId, petId);
        PlanCompanionReconcileCounts counts = PlanCompanionReconcileCounts.NONE;
        for (Plan target : targets) {
            try {
                counts = counts.plus(detachInTransaction(target.id(), petId));
            } catch (RuntimeException exception) {
                log.warn("Plan companion detach failed planId={} memberId={} petId={}",
                    target.id(), memberId, petId, exception);
            }
        }
        return counts;
    }

    private PlanCompanionReconcileCounts detachInTransaction(long planId, long petId) {
        return Objects.requireNonNullElse(
            transactionTemplate.execute(status -> detachFromPlan(planId, petId)),
            PlanCompanionReconcileCounts.NONE);
    }

    /**
     * 일정 하나에서 죽은 반려견을 떼어낸다. 트랜잭션 경계 안이다.
     *
     * <p><b>일정을 잠그고 다시 읽는다.</b> 이유는 둘이다.
     * <ul>
     *   <li><b>동시 실행 직렬화</b> — 죽은 아이가 둘(A·B) 실린 일정을 두 실행이 동시에 처리하면
     *       양쪽 모두 {@code [A, B]} 를 보고 각자 다른 행을 지워 <b>0행</b>이 된다. 서로 다른
     *       행이라 행 잠금으로는 직렬화되지 않는다. 그렇게 비면 다음 회차가 그 일정을 "옛 일정"
     *       으로 오인해 영구히 방치한다. 일정 행에서 직렬화하면 뒤에 온 쪽이 {@code [B]} 를 보고
     *       R3 로 남긴다</li>
     *   <li><b>최신 상태 확인</b> — 목록을 만든 뒤 완료로 넘어갔다면 그 일정은 이제 불가침이다</li>
     * </ul>
     *
     * <p>잠금 구간에 원격 호출이 없다 — 대사 배치의 auth-service 조회는 이 트랜잭션 바깥에서
     * 이미 끝나 있다.
     */
    private PlanCompanionReconcileCounts detachFromPlan(long planId, long petId) {
        Optional<Plan> reloaded = planRepositoryPort.findActiveByIdForUpdate(planId);
        if (reloaded.isEmpty() || !reloaded.get().status().isCompanionEditable()) {
            return PlanCompanionReconcileCounts.NONE;
        }
        Plan plan = reloaded.get();

        // plan 다음 plan_pet — 사용자 수정 경로(PlanCommandProcessor.updatePlan)와 같은 순서다.
        // 여기서도 잠그는 이유는 포트 계약에 있다: 타이밍 전제 없이 최신 커밋을 읽기 위해서다.
        List<PlanPet> pets = planPetRepositoryPort.findByPlanIdForUpdate(planId);
        if (pets.isEmpty()) {
            // 조인 테이블이 생기기 전의 옛 일정 — plan.pet_id 한 마리가 곧 동행 목록이다
            // (Plan.resolvePetIds). 지울 행 자체가 없으므로 R3 발동과는 다른 수로 센다.
            return PlanCompanionReconcileCounts.legacyPlanSkipped();
        }

        // 불변식은 "plan.pet_id = plan_pet 첫 행" 이다. 깨진 채로 발견됐다면 아래에서 복구되지만,
        // 어떻게 깨졌는지는 코드로 설명되지 않으므로 반드시 로그로 남긴다.
        boolean invariantBroken = plan.petId() != pets.get(0).petId();
        if (invariantBroken) {
            log.warn("Plan representative pet did not match the first plan_pet row planId={} planPetId={} firstPetId={}",
                planId, plan.petId(), pets.get(0).petId());
        }

        boolean carriesDeadPet = pets.stream().anyMatch(pet -> pet.petId() == petId);
        List<PlanPet> remaining = pets.stream().filter(pet -> pet.petId() != petId).toList();
        // 떼어내면 동행견이 0마리가 되는 일정 — 그 아이는 자리 표시자로 남는다 (R3).
        boolean keepsPlaceholder = carriesDeadPet && remaining.isEmpty();

        int detached = 0;
        if (carriesDeadPet && !keepsPlaceholder) {
            detached = planPetRepositoryPort.deleteByPlanIdAndPetId(planId, petId);
        }

        // 대표는 "남은 행 중 id 최소" = 저장 순서의 첫 아이. 자리 표시자를 남기는 일정은 그 한 마리가 곧 대표다.
        long representative = keepsPlaceholder ? pets.get(0).petId() : remaining.get(0).petId();
        int representativeChanged = 0;
        if (plan.petId() != representative) {
            // 일정 전체를 저장하지 않는다 — merge 는 모든 컬럼에 UPDATE 를 내므로 배치가 사용자의
            // 제목·기간 수정을 되돌릴 수 있다. pet_id 한 컬럼만 바꾸면 그 경로가 아예 없다.
            representativeChanged = planRepositoryPort.promoteRepresentative(planId, representative, plan.petId());
            if (representativeChanged == 0) {
                // 잠금을 잡은 뒤이므로 다른 정리 실행과는 겹치지 않는다. 남는 가능성은 같은 순간의
                // 사용자 수정이고, 그때는 사용자 쪽이 옳다 — 덮어쓰지 않고 다음 회차에 맡긴다.
                log.warn("Plan representative promotion skipped because it changed meanwhile planId={} expectedPetId={} petId={}",
                    planId, plan.petId(), representative);
            }
        }

        return keepsPlaceholder
            ? PlanCompanionReconcileCounts.placeholderKept(representativeChanged)
            : PlanCompanionReconcileCounts.detached(detached, representativeChanged);
    }
}
