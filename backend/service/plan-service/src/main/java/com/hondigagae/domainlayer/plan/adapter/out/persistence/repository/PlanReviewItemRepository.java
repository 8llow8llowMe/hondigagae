package com.hondigagae.domainlayer.plan.adapter.out.persistence.repository;

import com.hondigagae.domainlayer.plan.adapter.out.persistence.entity.PlanReviewItemEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface PlanReviewItemRepository extends JpaRepository<PlanReviewItemEntity, Long> {

    /**
     * 표시 순서는 요청 목록 순({@code sortOrder})이다. 아이디 tie-break 이 없으면 같은 순서가
     * 요청마다 갈릴 수 있다 — Processor 쪽 비교자와 같은 규칙이다.
     */
    List<PlanReviewItemEntity> findByReviewIdOrderBySortOrderAscIdAsc(Long reviewId);

    /**
     * 벌크 DML 로 <b>즉시</b> 지운다. 파생 delete 는 {@code em.remove} 큐잉이라 flush 때
     * INSERT 가 DELETE 보다 먼저 나간다. PUT 은 같은 (reviewId, planItemId) 를 재사용하므로
     * 옛 행이 남은 채 INSERT 되면 uk_plan_review_item_review_id_plan_item_id 위반으로 죽는다.
     *
     * <p>{@code clearAutomatically = true} 인 이유: 벌크 JPQL 은 영속성 컨텍스트를 건드리지 않아
     * 지운 행이 1차 캐시에 유령으로 남는다. 끄고 두면 같은 트랜잭션에서 재조회가 지운 행을
     * 그대로 돌려준다.
     */
    @Modifying(clearAutomatically = true)
    @Query("delete from PlanReviewItemEntity item where item.reviewId = :reviewId")
    void deleteByReviewId(Long reviewId);
}
