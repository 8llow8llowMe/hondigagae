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
    name = "plan_review",
    indexes = {
        @Index(name = "uk_plan_review_plan_id", columnList = "planId", unique = true)
    }
)
@Comment("여행 일정 후기")
public class PlanReviewEntity extends BaseEntity {

    @Id
    @Comment("후기 아이디")
    private Long id;

    @Column(nullable = false)
    @Comment("여행 일정 아이디 (FK: plan.id) - 일정당 후기 하나")
    private Long planId;

    @Column(nullable = false)
    @Comment("전체 만족도 (1~5)")
    private int overallRating;

    @Column(length = 2000)
    @Comment("후기 본문")
    private String body;
}
