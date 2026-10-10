package com.hondigagae.domainlayer.plan.adapter.out.persistence.repository;

import com.hondigagae.domainlayer.plan.adapter.out.persistence.entity.PlanPackingItemEntity;
import com.hondigagae.domainlayer.plan.domain.enums.PackingItemSource;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface PlanPackingItemRepository extends JpaRepository<PlanPackingItemEntity, Long> {

    /**
     * {@code sortOrder} 만으로는 동순위 순서가 보장되지 않아 아이디로 tie-break 한다 — 이게 없으면
     * 같은 목록이 요청마다 다른 순서로 나올 수 있다. 정렬 규칙은 {@code PlanPackingProcessor} 쪽
     * 비교자와 맞춰 둔다.
     */
    List<PlanPackingItemEntity> findByPlanIdOrderBySortOrderAscIdAsc(Long planId);

    /**
     * 벌크 DML 로 <b>즉시</b> 지운다. 파생 delete 는 {@code em.remove} 큐잉이라 flush 때
     * INSERT 가 DELETE 보다 먼저 나가는데, AI 항목 교체는 같은 (planId, name) 을 재사용하므로
     * 옛 행이 남은 채 INSERT 되어 uk_plan_packing_item_plan_id_name 위반으로 죽는다.
     *
     * <p>{@code clearAutomatically = true} 인 이유: 벌크 JPQL 은 영속성 컨텍스트를 건드리지 않아
     * 지운 행이 1차 캐시에 유령으로 남는다. 끄고 두면 같은 트랜잭션에서 {@code findById} 가 지운 행을
     * 그대로 돌려준다. 컨텍스트 <b>전체</b>가 detach 되지만 이 유스케이스는 삭제 이후 도메인 record 만
     * 쓰므로 무해하다 — 대신 이 호출 앞에 flush 되지 않은 쓰기를 쌓아 두면 안 된다.
     */
    @Modifying(clearAutomatically = true)
    @Query("delete from PlanPackingItemEntity item where item.planId = :planId and item.source = :source")
    void deleteByPlanIdAndSource(Long planId, PackingItemSource source);

    /**
     * 항목 하나 삭제도 벌크 DML 로 즉시 내보낸다. 소유권은 일정 기준으로 이미 확인했지만
     * planId 조건을 쿼리에도 남겨 둔다 — 항목 아이디만으로 지우는 경로를 아예 만들지 않는다.
     *
     * <p>{@code clearAutomatically = true} 인 이유는 위와 같다. 삭제 직전에 {@code findById} 로
     * 소유권을 확인하므로 그 인스턴스가 1차 캐시에 그대로 남아, 응답을 "삭제 후 갱신된 목록" 으로
     * 바꾸는 순간 지운 행이 되살아난다.
     */
    @Modifying(clearAutomatically = true)
    @Query("delete from PlanPackingItemEntity item where item.planId = :planId and item.id = :packingItemId")
    void deleteByPlanIdAndId(Long planId, Long packingItemId);
}
