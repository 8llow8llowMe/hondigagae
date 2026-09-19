package com.hondigagae.domainlayer.plan.application.service.processor;

import com.hondigagae.domainlayer.plan.application.model.PlanCompanionReconcileCounts;
import com.hondigagae.domainlayer.plan.application.port.out.PetConditionQueryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanPetRepositoryPort;
import com.hondigagae.domainlayer.plan.application.port.out.PlanRepositoryPort;
import com.hondigagae.domainlayer.plan.domain.model.Plan;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 회원 한 명의 동행 반려견을 원천(auth-service)과 대사한다 (#720).
 *
 * <p><b>왜 푸시가 아니라 대사인가</b> — auth-service 가 반려견 삭제 시 plan-service 를 부르게
 * 하면 auth 에 첫 아웃바운드 의존이 생기고 auth ↔ plan 순환이 만들어진다. 정리는 하루 늦어도
 * 되는 일이라 <b>plan 이 물어보는</b> 한 방향으로 둔다. 기존 잔여 행도 이 배치의 첫 회차가
 * 함께 정리하므로 별도 마이그레이션 DML 이 없다.
 *
 * <p><b>회원마다 원격 호출 한 번은 줄이지 않는다.</b> auth 의 벌크 내부 API 가 {@code memberId}
 * 단위 계약({@code GET /internal/v1/pets/conditions?memberId=&petIds=})이라 회원을 가로질러
 * 묶을 수 없다. 대신 <b>한 회원의 모든 일정에 실린 반려견을 한 번에</b> 묻는다 — 일정마다
 * 묻지 않는 것이 여기서 지킬 수 있는 §9-7 이다.
 */
@Component
@RequiredArgsConstructor
public class PlanCompanionReconcileProcessor {

    private final PlanRepositoryPort planRepositoryPort;
    private final PlanPetRepositoryPort planPetRepositoryPort;
    private final PetConditionQueryPort petConditionQueryPort;
    private final PlanPetDetachProcessor planPetDetachProcessor;

    /** 정리 대상 일정을 가진 회원 아이디 페이지. 스케줄러가 커서로 훑는다. */
    public List<Long> findMemberIdsToReconcile(long lastMemberId, int size) {
        return planRepositoryPort.findMemberIdsWithCompanionEditablePlans(lastMemberId, size);
    }

    /**
     * 회원 한 명의 미완료 일정에 실린 반려견 중 <b>원천에 더 이상 없는</b> 아이를 떼어낸다.
     *
     * @throws com.hondigagae.domainlayer.plan.application.exception.PlanException auth-service 조회
     *         실패(503). 호출부가 회차를 중단한다 — 응답을 못 받은 것을 "전부 삭제됨" 으로 읽으면
     *         멀쩡한 동행견을 떼어낸다
     */
    public PlanCompanionReconcileCounts reconcileMember(long memberId) {
        List<Long> referencedPetIds = collectReferencedPetIds(memberId);
        if (referencedPetIds.isEmpty()) {
            return PlanCompanionReconcileCounts.NONE;
        }

        // 빈 응답은 "요청한 아이가 전부 삭제됐다" 는 정상 답이다 — auth 의 조회는 요청 petIds 와의
        // 교집합을 내므로 소유한 아이가 하나도 없으면 빈 목록을 200 으로 돌려준다. 그래서 그 경우
        // 회원을 건너뛰면 정작 정리 대상인 일정을 영구히 놓친다. 응답을 아예 못 받은 경우(503)만
        // 위험하고, 그건 예외로 올라가 호출부가 회차를 멈춘다.
        Set<Long> ownedPetIds = petConditionQueryPort.findOwnedPetIds(memberId, referencedPetIds);

        List<Long> deletedPetIds = referencedPetIds.stream().filter(petId -> !ownedPetIds.contains(petId)).toList();
        PlanCompanionReconcileCounts counts = PlanCompanionReconcileCounts.remoteCall();
        for (Long deletedPetId : deletedPetIds) {
            counts = counts.plus(planPetDetachProcessor.detachPet(memberId, deletedPetId));
        }
        return counts;
    }

    /**
     * 회원의 미완료 일정에 실린 반려견 아이디 전부 (중복 제거, 처음 등장 순서).
     *
     * <p>대표 컬럼({@code plan.pet_id})과 조인 테이블을 <b>모두</b> 본다. 옛 일정은 조인 테이블에
     * 행이 없어 대표 컬럼으로만 알 수 있고, 불변식이 깨진 일정은 대표가 조인 테이블 밖에 있다.
     * 조인 테이블 조회는 일정마다가 아니라 {@code in} 절 한 번이다 (§9-7).
     */
    private List<Long> collectReferencedPetIds(long memberId) {
        List<Plan> plans = planRepositoryPort.findCompanionEditablePlans(memberId);
        if (plans.isEmpty()) {
            return List.of();
        }
        Set<Long> petIds = new LinkedHashSet<>();
        plans.forEach(plan -> petIds.add(plan.petId()));
        planPetRepositoryPort.findByPlanIds(plans.stream().map(Plan::id).toList())
            .forEach(planPet -> petIds.add(planPet.petId()));
        return List.copyOf(petIds);
    }
}
