package com.hondigagae.domainlayer.place.adapter.out.persistence.entity;

import com.hondigagae.persistence.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
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
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Table(
    name = "place_intro",
    indexes = {
        @Index(name = "uk_place_intro_place_id", columnList = "placeId", unique = true)
    }
)
public class PlaceIntroEntity extends BaseEntity {

    @Id
    @Comment("장소 소개 아이디 (Snowflake)")
    private Long id;

    @Column(nullable = false)
    @Comment("장소 아이디 (FK: place.id)")
    private Long placeId;

    @Column(length = 200)
    @Comment("문의처")
    private String infoCenter;

    @Column(length = 300)
    @Comment("운영시간")
    private String useTime;

    @Column(length = 300)
    @Comment("구조화된 주간 영업시간(WeeklySchedule spec). null 이면 원문을 풀 수 없었던 곳 — 영업 여부를 모름으로 본다")
    private String weeklyHoursSpec;

    @Column(nullable = false)
    @Comment("24시간 운영 여부. 상호에 24시가 있거나 운영시간이 00:00~24:00 인 경우만 true")
    private boolean open24;

    @Column(length = 200)
    @Comment("휴무일")
    private String restDate;

    @Column(length = 300)
    @Comment("주차")
    private String parking;

    @Column(length = 200)
    @Comment("애완동물 동반 가능 원문 (detailIntro2 chkpet — 빈 값 많음, 판단은 place_pet_info 우선)")
    private String chkPet;

    @Column(length = 100)
    @Comment("유모차 대여")
    private String chkBabyCarriage;

    @Column(length = 100)
    @Comment("신용카드 가능")
    private String chkCreditCard;

    @Column(columnDefinition = "JSON")
    @Comment("detailIntro2 타입별 전체 원문 (JSON)")
    private String rawJson;

    @Column(nullable = false)
    @Comment("적재 시각")
    private LocalDateTime syncedAt;
}
