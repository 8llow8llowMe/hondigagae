package com.hondigagae.domainlayer.plan.application.port.out;

import com.hondigagae.domainlayer.plan.domain.model.Plan;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Slice;

public interface PlanRepositoryPort {

    Plan save(Plan plan);

    Optional<Plan> findActiveById(long planId);

    /** petId 가 null 이 아니면 그 반려견이 동행한 일정만 — 여러 마리 중 한 마리로 들어 있어도 히트다 (반려견별 여행 히스토리). */
    Slice<Plan> findMyPlans(long memberId, Long petId, long lastPlanId, int size);

    /**
     * 동행견 정리 대상 — 한 회원의 <b>미완료·미삭제</b> 일정 중 이 반려견을 실은 것 전부.
     *
     * <p>완료된 일정은 빠진다. 다녀온 기록의 동행견은 사용자도 바꿀 수 없고({@code PLAN_019})
     * 배치도 바꾸지 않는다.
     */
    List<Plan> findCompanionEditablePlansWithPet(long memberId, long petId);

    /** 한 회원의 미완료·미삭제 일정 전부. 어떤 반려견이 실려 있는지 모으기 위한 입력이다. */
    List<Plan> findCompanionEditablePlans(long memberId);

    /**
     * 정리 대상 일정을 가진 회원 아이디 페이지.
     *
     * @param lastMemberId 이 값보다 <b>큰</b> 아이디부터. 첫 페이지는 0
     * @return memberId 오름차순. 비어 있으면 더 볼 회원이 없다
     */
    List<Long> findMemberIdsWithCompanionEditablePlans(long lastMemberId, int size);

    /**
     * 동행견 정리용 재조회 — 일정 행을 <b>잠그고</b> 읽는다.
     *
     * <p>같은 일정을 동시에 정리하는 두 실행이 서로 다른 {@code plan_pet} 행을 지워 동행견이
     * 0마리가 되는 것을 막는다. 잠금 구간은 일정 하나짜리 트랜잭션이고 그 안에 원격 호출이 없다.
     * 사용자 조회 경로는 {@link #findActiveById} 를 그대로 쓴다 — 조회가 배치를 기다릴 이유가 없다.
     */
    Optional<Plan> findActiveByIdForUpdate(long planId);

    /**
     * 대표 반려견 승계 — {@code petId} 한 컬럼만 바꾼다.
     *
     * <p>일정 전체를 저장하지 않는 이유는 배치가 들고 있는 스냅샷으로 사용자의 다른 수정을
     * 되돌리지 않기 위해서다.
     *
     * @param expectedPetId 바꾸기 직전에 읽은 대표. 그 사이 값이 바뀌었으면 아무것도 하지 않는다
     * @return 실제로 바꾼 행 수 (0 또는 1)
     */
    int promoteRepresentative(long planId, long petId, long expectedPetId);
}
