package com.hondigagae.domainlayer.plan.adapter.out.persistence.entity;

import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import com.hondigagae.persistence.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.LocalDate;
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
    name = "plan",
    indexes = {
        // 내 일정 목록: where memberId, deleted + order by id(커서)
        @Index(name = "idx_plan_member_id_deleted_id",
            columnList = "memberId,deleted,id"),
        @Index(name = "idx_plan_member_id_deleted_start_date",
            columnList = "memberId,deleted,startDate"),
        // AI 초안 담기 멱등 (#970): 같은 작업을 두 번 담아도 일정은 하나다. 동시 요청 경쟁의 마지막 방어선이다.
        // NULL 은 서로 다른 값으로 보므로(MySQL) 일반 생성·옛 일정·삭제된 일정(키를 비운다)은 걸리지 않는다.
        @Index(name = "uk_plan_member_id_source_ai_job_id",
            columnList = "memberId,sourceAiJobId", unique = true)
    }
)
@Comment("여행 일정")
public class PlanEntity extends BaseEntity {

    @Id
    @Comment("여행 일정 아이디")
    private Long id;

    @Column(nullable = false)
    @Comment("회원 아이디 (FK: member.id)")
    private Long memberId;

    @Column(nullable = false)
    @Comment("대표 반려견 아이디 (FK: pet.id) - 동행 전체 목록은 plan_pet, 이 값은 그 첫 번째와 같다")
    private Long petId;

    @Column(nullable = false, length = 4)
    @Comment("관광 지역코드 (제주=39)")
    private String areaCode;

    @Column(length = 6)
    @Comment("관광 시군구코드")
    private String sigunguCode;

    @Column(nullable = false, length = 60)
    @Comment("일정 제목")
    private String title;

    @Column(nullable = false)
    @Comment("여행 시작일")
    private LocalDate startDate;

    @Column(nullable = false)
    @Comment("여행 종료일")
    private LocalDate endDate;

    @Comment("예산 (원)")
    private Integer budget;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Comment("일정 상태")
    private PlanStatus status;

    @Column(nullable = false)
    @Comment("삭제 여부 (soft delete)")
    private boolean deleted;

    @Column(length = 36)
    @Comment("AI 일정 생성 작업 아이디 (ai-service jobId, UUID). 담기 멱등 키 — 같은 작업을 다시 담으면 이 값으로 기존 일정을 찾는다. "
        + "삭제(soft delete) 때 비운다")
    private String sourceAiJobId;
}
