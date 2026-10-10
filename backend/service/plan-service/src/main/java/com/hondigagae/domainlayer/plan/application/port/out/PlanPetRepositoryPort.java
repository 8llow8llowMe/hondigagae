package com.hondigagae.domainlayer.plan.application.port.out;

import com.hondigagae.domainlayer.plan.domain.model.PlanPet;
import java.util.Collection;
import java.util.List;

/**
 * 일정 동행 반려견 저장소 계약.
 *
 * <p>조회 결과가 비어 있을 수 있다 — 조인 테이블이 생기기 전의 일정이다. 그 해석
 * ({@code plan.petId} 한 마리로 읽는다)은 도메인({@code Plan.resolvePetIds})이 갖고,
 * 이 포트는 저장된 그대로만 돌려준다.
 */
public interface PlanPetRepositoryPort {

    List<PlanPet> saveAll(List<PlanPet> pets);

    /** 저장 순서대로. 첫 번째가 대표 반려견이다. */
    List<PlanPet> findByPlanId(long planId);

    /**
     * 저장 순서대로 읽되 <b>읽은 행을 잠근다</b> (동행견 정리 전용).
     *
     * <p>잠그지 않으면 레이스 차단이 "정리 트랜잭션의 첫 SQL 이 locking read 여야 최신 커밋을
     * 본다" 는 타이밍 전제에 걸린다. 여기서도 잠그면 호출 순서와 무관하게 최신 상태를 읽는다.
     */
    List<PlanPet> findByPlanIdForUpdate(long planId);

    /** 목록 화면용 벌크 조회 — 일정마다 따로 부르면 페이지 크기만큼 왕복한다 (coding-conventions §9-7). */
    List<PlanPet> findByPlanIds(Collection<Long> planIds);

    /** 동행견 교체용. 지운 뒤 새로 넣는다. */
    void deleteByPlanId(long planId);

    /**
     * 삭제된 반려견 한 마리를 일정에서 떼어낸다 (동행견 대사 배치).
     *
     * @return 실제로 지운 행 수. 0 이면 이미 떼어낸 뒤다 — 배치 재실행이 멱등인 근거다
     */
    int deleteByPlanIdAndPetId(long planId, long petId);
}
