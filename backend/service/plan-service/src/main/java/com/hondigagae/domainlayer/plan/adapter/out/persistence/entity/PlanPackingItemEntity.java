package com.hondigagae.domainlayer.plan.adapter.out.persistence.entity;

import com.hondigagae.domainlayer.plan.domain.enums.PackingItemSource;
import com.hondigagae.persistence.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
    name = "plan_packing_item",
    indexes = {
        @Index(name = "uk_plan_packing_item_plan_id_name",
            columnList = "planId,name", unique = true),
        @Index(name = "idx_plan_packing_item_plan_id_sort_order",
            columnList = "planId,sortOrder")
    }
)
@Comment("여행 일정 준비물 항목")
public class PlanPackingItemEntity extends BaseEntity {

    @Id
    @Comment("준비물 항목 아이디")
    private Long id;

    @Column(nullable = false)
    @Comment("여행 일정 아이디 (FK: plan.id)")
    private Long planId;

    @Column(nullable = false, length = 30)
    @Comment("준비물 분류 - 값의 원천이 LLM 이라 enum 으로 굳히지 않는다 (프롬프트가 바뀌면 분류가 늘어난다)")
    private String category;

    @Column(nullable = false, length = 100)
    @Comment("준비물 이름")
    private String name;

    @Column(length = 500)
    @Comment("이 여행 데이터 기반의 준비 이유 (사용자 추가 항목은 없음)")
    private String reason;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    @Comment("출처 (AI: AI 추천, USER: 사용자 추가)")
    private PackingItemSource source;

    @Column(nullable = false)
    @Comment("챙김 체크 - AI 재생성 시 같은 이름의 항목에 승계된다")
    private boolean checked;

    @Column(nullable = false)
    @Comment("표시 순서 (0부터)")
    private int sortOrder;
}
