package com.hondigagae.domainlayer.plan.adapter.out.persistence.entity;

import com.hondigagae.persistence.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Comment;

@Entity
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PROTECTED)
@Table(
    name = "plan_review_item",
    indexes = {
        @Index(name = "uk_plan_review_item_review_id_plan_item_id",
            columnList = "reviewId,planItemId", unique = true),
        @Index(name = "idx_plan_review_item_review_id_sort_order",
            columnList = "reviewId,sortOrder")
    }
)
@Comment("여행 후기 방문 장소 평가")
public class PlanReviewItemEntity extends BaseEntity {

    @Id
    @Comment("후기 장소 평가 아이디")
    private Long id;

    @Column(nullable = false)
    @Comment("여행 후기 아이디 (FK: plan_review.id)")
    private Long reviewId;

    @Column(nullable = false)
    @Comment("일정 항목 아이디 (FK: plan_item.id, 항목 삭제 후에도 스냅샷 유지)")
    private Long planItemId;

    @Comment("장소 아이디 (FK: place.id) - 작성 시점 PlanItem.targetId. 대상 없는 항목은 없음")
    private Long placeId;

    @Column(nullable = false, length = 100)
    @Comment("작성 시점의 일정 항목 이름")
    private String title;

    @Column(nullable = false)
    @Comment("장소 만족도 (1~5)")
    private int rating;

    @Column(length = 200)
    @Comment("장소 한 줄 후기")
    private String comment;

    @Column(nullable = false)
    @Comment("표시 순서 (요청 목록의 0부터)")
    private int sortOrder;
}
