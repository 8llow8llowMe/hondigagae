package com.hondigagae.domainlayer.plan.adapter.out.persistence.repository;

import com.hondigagae.domainlayer.plan.adapter.out.persistence.entity.PlanEntity;
import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface PlanRepository extends JpaRepository<PlanEntity, Long> {

    Optional<PlanEntity> findByIdAndDeletedFalse(Long id);

    Slice<PlanEntity> findByMemberIdAndDeletedFalseAndIdLessThanOrderByIdDesc(Long memberId, Long lastPlanId, Pageable pageable);

    /**
     * 반려견별 여행 히스토리 — <b>동행 목록에 한 마리라도 들어 있으면 히트</b>다.
     *
     * <p>조인 테이블(plan_pet)과 대표 컬럼(plan.pet_id)을 함께 본다. 조인 테이블이 생기기 전의
     * 일정은 plan_pet 에 행이 없어 대표 컬럼으로만 찾을 수 있고, 새 일정의 두 번째 이후 반려견은
     * 조인 테이블로만 찾을 수 있다. 어느 한쪽만 보면 옛 일정 또는 동행견이 히스토리에서 빠진다.
     * or-null 조건 대신 메서드를 나눈다 (coding-conventions 쿼리 규칙).
     */
    @Query("""
        select p from PlanEntity p
        where p.memberId = :memberId
          and p.deleted = false
          and p.id < :lastPlanId
          and (p.petId = :petId
               or p.id in (select pp.planId from PlanPetEntity pp where pp.petId = :petId))
        order by p.id desc
        """)
    Slice<PlanEntity> findMyPlansWithPet(Long memberId, Long petId, Long lastPlanId, Pageable pageable);

    /**
     * 동행견 정리 대상 — 한 회원의 <b>아직 바꿀 수 있는</b> 일정 중 이 반려견을 실은 것.
     *
     * <p>히스토리 조회({@link #findMyPlansWithPet})와 같은 "한 마리라도 동행이면 히트" 조건을
     * 쓴다. 다른 점은 둘이다 — 커서가 없고(정리는 전량을 훑는다), {@code status} 를 받아
     * <b>완료된 일정을 제외</b>한다. 완료 일정은 다녀온 기록이라 배치가 손대지 않는다
     * ({@code PlanStatus.companionEditableStatuses}).
     *
     * <p>{@code id} 오름차순은 저장 순서다 — 로그에 찍히는 처리 순서가 실행마다 흔들리지 않는다.
     */
    @Query("""
        select p from PlanEntity p
        where p.memberId = :memberId
          and p.deleted = false
          and p.status in :statuses
          and (p.petId = :petId
               or p.id in (select pp.planId from PlanPetEntity pp where pp.petId = :petId))
        order by p.id asc
        """)
    List<PlanEntity> findCompanionEditablePlansWithPet(Long memberId, Long petId, Collection<PlanStatus> statuses);

    /** 한 회원의 정리 대상 일정 전부. 어떤 반려견이 실려 있는지 모아 한 번에 생존 여부를 묻기 위한 입력이다. */
    @Query("""
        select p from PlanEntity p
        where p.memberId = :memberId
          and p.deleted = false
          and p.status in :statuses
        order by p.id asc
        """)
    List<PlanEntity> findCompanionEditablePlans(Long memberId, Collection<PlanStatus> statuses);

    /**
     * 정리 대상 일정을 가진 회원 아이디 페이지 (커서 = memberId 오름차순).
     *
     * <p><b>offset 페이징을 쓰지 않는다.</b> 대사 배치는 행을 지우지 않으므로 offset 이어도
     * 흔들리지 않지만, 같은 회차 안에서 일정이 새로 생기면 경계가 밀린다. 커서는 그 영향을 받지
     * 않고, 지금까지 어디까지 훑었는지가 로그로 설명된다.
     */
    @Query("""
        select distinct p.memberId from PlanEntity p
        where p.deleted = false
          and p.status in :statuses
          and p.memberId > :lastMemberId
        order by p.memberId asc
        """)
    List<Long> findMemberIdsWithCompanionEditablePlans(Long lastMemberId, Collection<PlanStatus> statuses, Pageable pageable);

    /**
     * 동행견 정리용 재조회 — 일정 행을 <b>비관 잠금</b>으로 잡는다.
     *
     * <p>잠금이 없으면 죽은 아이가 둘(A·B) 실린 일정을 두 인스턴스가 동시에 처리할 때
     * 양쪽 모두 {@code plan_pet = [A, B]} 를 보고 각자 다른 행을 지운다. <b>서로 다른 행이라
     * 행 잠금으로 직렬화되지 않아</b> 결과가 0행이 되고, 다음 회차는 그 일정을 "조인 테이블이
     * 생기기 전의 옛 일정" 으로 오인해 영구히 방치한다 — R3 가 깨지고 스스로 복구도 못 한다.
     *
     * <p>일정 행에서 직렬화하면 뒤에 온 쪽이 {@code [B]} 를 보고 R3 로 남긴다. 배치가 잡는
     * 잠금은 일정 단위 트랜잭션 안에서만 살아 있고 그 구간에 원격 호출이 없다.
     *
     * <p>사용자 경로가 쓰는 {@code findByIdAndDeletedFalse} 는 잠금 없이 그대로 둔다 —
     * 조회가 배치를 기다릴 이유가 없다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from PlanEntity p where p.id = :planId and p.deleted = false")
    Optional<PlanEntity> findActiveByIdForUpdate(Long planId);

    /**
     * 대표 반려견 승계 — {@code pet_id} <b>한 컬럼만</b> 바꾼다.
     *
     * <p>{@code save} 는 merge 라 모든 updatable 컬럼에 정적 UPDATE 를 낸다
     * ({@code PlanEntity} 에 {@code @DynamicUpdate}·{@code @Version} 이 없다). 배치가 들고 있는
     * 스냅샷이 조금이라도 낡으면 사용자의 제목·기간 수정을 되돌린다. 한 컬럼 DML 이면 <b>다른
     * 컬럼을 건드릴 방법 자체가 없어</b> 그 유실 경로가 구조적으로 사라진다.
     *
     * <p>{@code expectedPetId} 는 낙관적 조건이다. 0 이 돌아오면 그 사이 누가 대표를 바꾼 것이니
     * 덮어쓰지 않는다 — 다음 회차가 다시 만난다.
     *
     * <p>벌크 DML 이라 {@code updated_at}(@LastModifiedDate)은 갱신되지 않는다. 의도한 것이다 —
     * 배치가 청소한 것을 사용자에게 "일정을 수정했다" 로 보이게 할 이유가 없다.
     *
     * @return 실제로 바꾼 행 수 (0 또는 1)
     */
    @Modifying
    @Query("update PlanEntity p set p.petId = :petId where p.id = :planId and p.petId = :expectedPetId")
    int promoteRepresentative(Long planId, Long petId, Long expectedPetId);
}
