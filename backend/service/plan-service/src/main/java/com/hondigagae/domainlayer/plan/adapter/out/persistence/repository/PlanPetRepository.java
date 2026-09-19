package com.hondigagae.domainlayer.plan.adapter.out.persistence.repository;

import com.hondigagae.domainlayer.plan.adapter.out.persistence.entity.PlanPetEntity;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface PlanPetRepository extends JpaRepository<PlanPetEntity, Long> {

    /** id 오름차순 = 저장 순서. 첫 행이 대표 반려견({@code plan.pet_id})과 같다. */
    List<PlanPetEntity> findByPlanIdOrderByIdAsc(Long planId);

    /**
     * 동행견 정리용 조회 — 읽은 행을 <b>잠근다</b>.
     *
     * <p>일정 행을 이미 잠갔으므로 정리끼리는 이것 없이도 직렬화된다. 그런데 그 직렬화는
     * "locking read 는 read view 를 만들지 않아 뒤따르는 일반 {@code SELECT} 가 그제서야 read view 를
     * 만들고, 그래서 앞 트랜잭션의 커밋을 본다" 는 <b>REPEATABLE READ 의 타이밍 전제</b>에 걸려 있다.
     * 누가 트랜잭션 맨 앞에 일반 조회 한 줄만 넣어도 read view 가 먼저 열려 옛 스냅샷을 읽고,
     * 0행 레이스가 조용히 부활한다.
     *
     * <p>여기서도 잠그면 그 전제가 사라진다 — locking read 는 언제 불리든 <b>최신 커밋</b>을 읽는다.
     * 잠금 순서(plan → plan_pet)는 사용자 수정 경로와 같게 맞춘다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select pet from PlanPetEntity pet where pet.planId = :planId order by pet.id asc")
    List<PlanPetEntity> findByPlanIdOrderByIdAscForUpdate(Long planId);

    List<PlanPetEntity> findByPlanIdInOrderByIdAsc(Collection<Long> planIds);

    /**
     * 벌크 DML 로 <b>즉시</b> 지운다. 파생 delete 는 {@code em.remove} 큐잉이라 flush 때
     * INSERT 가 DELETE 보다 먼저 나가는데, 동행견 교체는 같은 (planId, petId) 를 재사용하므로
     * (예: [1, 2] → [2, 3]) 옛 행이 남은 채 INSERT 되어
     * uk_plan_pet_plan_id_pet_id 위반으로 죽는다 — 일자 항목 교체와 같은 함정이다.
     */
    @Modifying
    @Query("delete from PlanPetEntity pet where pet.planId = :planId")
    void deleteByPlanId(Long planId);

    /**
     * 삭제된 반려견 한 마리를 일정에서 떼어낸다 (동행견 대사 배치).
     *
     * <p>{@link #deleteByPlanId} 와 같은 이유로 벌크 DML 이다 — 파생 delete 는 엔티티를 먼저
     * 읽어 {@code em.remove} 로 큐잉하므로, 같은 트랜잭션에서 뒤이어 {@code plan.pet_id} 를
     * 저장할 때 DELETE 가 아직 안 나간 상태로 섞인다. 여기서는 재삽입이 없어 유니크 인덱스
     * 위반까지 가지는 않지만, 두 경로가 서로 다른 삭제 방식을 쓸 이유가 없다.
     *
     * @return 실제로 지운 행 수. 0 이면 이미 떼어낸 뒤다 — 배치 재실행이 멱등인 근거다
     */
    @Modifying
    @Query("delete from PlanPetEntity pet where pet.planId = :planId and pet.petId = :petId")
    int deleteByPlanIdAndPetId(Long planId, Long petId);
}
