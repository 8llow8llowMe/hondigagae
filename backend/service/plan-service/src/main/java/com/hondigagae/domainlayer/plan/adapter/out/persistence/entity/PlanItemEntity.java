package com.hondigagae.domainlayer.plan.adapter.out.persistence.entity;

import com.hondigagae.domainlayer.plan.domain.enums.PlanItemType;
import com.hondigagae.persistence.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.LocalTime;
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
    name = "plan_item",
    indexes = {
        @Index(name = "uk_plan_item_plan_id_day_sequence",
            columnList = "planId,day,sequence", unique = true)
    }
)
@Comment("여행 일정 항목")
public class PlanItemEntity extends BaseEntity {

    @Id
    @Comment("일정 항목 아이디")
    private Long id;

    @Column(nullable = false)
    @Comment("여행 일정 아이디 (FK: plan.id)")
    private Long planId;

    @Column(nullable = false)
    @Comment("일차 (1부터 시작)")
    private int day;

    @Column(nullable = false)
    @Comment("일차 내 순서 (1부터 시작)")
    private int sequence;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Comment("항목 유형")
    private PlanItemType itemType;

    @Comment("항목 대상 아이디 (FK: place.id 또는 walk_course.id, itemType 에 따라 분기)")
    private Long targetId;

    @Column(nullable = false, length = 100)
    @Comment("항목 이름")
    private String title;

    @Column(length = 500)
    @Comment("메모")
    private String memo;

    @Comment("시작 시각")
    private LocalTime startTime;

    @Column(nullable = false)
    @Comment("방문 체크 (다녀옴) - 일차 항목을 교체하면 새 항목이라 체크가 초기화된다")
    private boolean visited;
}
