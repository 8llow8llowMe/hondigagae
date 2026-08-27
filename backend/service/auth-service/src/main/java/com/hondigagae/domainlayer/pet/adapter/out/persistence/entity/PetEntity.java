package com.hondigagae.domainlayer.pet.adapter.out.persistence.entity;

import com.hondigagae.shared.travel.pet.ActivityLevel;
import com.hondigagae.shared.travel.pet.PetSizeType;
import com.hondigagae.shared.travel.pet.SocialityLevel;
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
    name = "pet",
    indexes = {
        @Index(name = "idx_pet_member_id_deleted", columnList = "memberId,deleted")
    })
public class PetEntity extends BaseEntity {

    @Id
    @Comment("반려견 아이디 (Snowflake)")
    private Long id;

    @Column(nullable = false)
    @Comment("회원 아이디 (FK: member.id)")
    private Long memberId;

    @Column(nullable = false, length = 20)
    @Comment("반려견 이름")
    private String name;

    @Column(length = 50)
    @Comment("품종")
    private String breed;

    @Column(length = 7)
    @Comment("생년월 (yyyy-MM)")
    private String birthYm;

    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    @Comment("크기 구분 (SMALL/MEDIUM/LARGE)")
    private PetSizeType sizeType;

    @Column(nullable = false)
    @Comment("더위 민감 여부")
    private boolean heatSensitive;

    @Column(nullable = false)
    @Comment("추위 민감 여부")
    private boolean coldSensitive;

    @Column(nullable = false)
    @Comment("소음 민감 여부")
    private boolean noiseSensitive;

    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    @Comment("활동량 (LOW/MEDIUM/HIGH)")
    private ActivityLevel activityLevel;

    @Column(nullable = false)
    @Comment("산책 선호 여부")
    private boolean walkPreferred;

    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    @Comment("사회성 (LOW/MEDIUM/HIGH)")
    private SocialityLevel sociality;

    @Column(nullable = false)
    @Comment("삭제 여부 (소프트 삭제 — 기존 일정이 참조하므로 물리 삭제하지 않는다)")
    private boolean deleted;
}
