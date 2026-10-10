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

/**
 * 일정 ↔ 반려견 다대다 조인 테이블.
 *
 * <p>{@code plan.pet_id} 는 그대로 남아 <b>대표(첫 번째) 반려견</b>을 가리키고, 동행하는
 * 전체 목록은 이 테이블이 갖는다. 이 테이블이 생기기 전의 일정은 여기에 행이 없다 —
 * 그때는 {@code plan.pet_id} 한 마리가 곧 목록이다 ({@code Plan.resolvePetIds}).
 * 그래서 기존 행을 옮기는 SQL 없이 배포할 수 있다.
 */
@Entity
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PROTECTED)
@Table(
    name = "plan_pet",
    indexes = {
        @Index(name = "uk_plan_pet_plan_id_pet_id",
            columnList = "planId,petId", unique = true),
        // 반려견별 여행 히스토리: where petId → planId 집합
        @Index(name = "idx_plan_pet_pet_id_plan_id",
            columnList = "petId,planId")
    }
)
@Comment("여행 일정 동행 반려견")
public class PlanPetEntity extends BaseEntity {

    @Id
    @Comment("일정 동행 반려견 아이디")
    private Long id;

    @Column(nullable = false)
    @Comment("여행 일정 아이디 (FK: plan.id)")
    private Long planId;

    @Column(nullable = false)
    @Comment("반려견 아이디 (FK: pet.id)")
    private Long petId;
}
