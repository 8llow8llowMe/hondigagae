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
 * 일정 완료 시점의 동행 반려견 특성 스냅샷.
 *
 * <p>{@code plan_pet} 이 "누가 갔는가" 라면 이 테이블은 "그때 그 아이가 어땠는가" 다.
 * 완료된 일정의 판정은 auth-service 를 다시 읽지 않고 이 행을 쓴다.
 *
 * <p>{@code sizeType}·{@code activityLevel} 을 문자열로 둔 이유는 {@code PetConditionQueryResult}
 * 와 같다 — 이 서비스는 값을 해석하지 않고 전달만 하므로, enum 으로 굳히면 auth-service 가
 * 값을 늘릴 때마다 옛 스냅샷이 읽히지 않게 된다.
 */
@Entity
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PROTECTED)
@Table(
    name = "plan_pet_condition",
    indexes = {
        @Index(name = "uk_plan_pet_condition_plan_id_pet_id",
            columnList = "planId,petId", unique = true)
    }
)
@Comment("일정 완료 시점의 동행 반려견 특성 스냅샷")
public class PlanPetConditionEntity extends BaseEntity {

    @Id
    @Comment("일정 반려견 특성 스냅샷 아이디")
    private Long id;

    @Column(nullable = false)
    @Comment("여행 일정 아이디 (FK: plan.id)")
    private Long planId;

    @Column(nullable = false)
    @Comment("반려견 아이디 (FK: pet.id, 프로필 삭제 후에도 스냅샷 유지)")
    private Long petId;

    @Column(length = 50)
    @Comment("완료 시점의 견종 - 단두종 판정에 쓴다. 모르면 없음")
    private String breed;

    @Column(length = 20)
    @Comment("완료 시점의 크기 구분 - 해석은 tour-service 가 한다. 모르면 없음")
    private String sizeType;

    @Column(nullable = false)
    @Comment("완료 시점의 더위 민감 여부")
    private boolean heatSensitive;

    @Column(nullable = false)
    @Comment("완료 시점의 추위 민감 여부")
    private boolean coldSensitive;

    @Column(nullable = false)
    @Comment("완료 시점의 소음 민감 여부")
    private boolean noiseSensitive;

    @Column(length = 20)
    @Comment("완료 시점의 활동량 - 해석은 tour-service 가 한다. 모르면 없음")
    private String activityLevel;
}
