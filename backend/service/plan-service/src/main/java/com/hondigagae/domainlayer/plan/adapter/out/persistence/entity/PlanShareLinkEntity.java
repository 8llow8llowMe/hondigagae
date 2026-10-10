package com.hondigagae.domainlayer.plan.adapter.out.persistence.entity;

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
@AllArgsConstructor(access = AccessLevel.PROTECTED)
@Table(
    name = "plan_share_link",
    indexes = {
        // 공개 조회는 토큰 하나로 들어온다. 유니크라 중복 발급도 여기서 막힌다.
        @Index(name = "uk_plan_share_link_token", columnList = "token", unique = true),
        // 멱등 발급·폐기: where planId + revokedAt is null
        @Index(name = "idx_plan_share_link_plan_id_revoked_at", columnList = "planId,revokedAt")
    }
)
@Comment("여행 일정 읽기 전용 공유 링크")
public class PlanShareLinkEntity extends BaseEntity {

    @Id
    @Comment("공유 링크 아이디")
    private Long id;

    @Column(nullable = false)
    @Comment("여행 일정 아이디 (FK: plan.id)")
    private Long planId;

    /**
     * <b>콜레이션을 바이트 비교로 못박는다.</b> 이 스키마의 기본은 {@code utf8mb4_unicode_ci} 라
     * 대소문자를 무시하는데, Base64url 은 대소문자를 <b>구분하는</b> 인코딩이다. 그대로 두면
     * {@code aB…} 와 {@code Ab…} 가 같은 토큰으로 매칭되고 유니크 제약도 그 규칙으로 걸린다 —
     * 토큰 공간이 줄고, 대소문자만 다른 토큰으로 남의 일정이 열린다. 불투명 비밀값이라
     * 바이트 비교가 맞다. H2 슬라이스는 원래 대소문자를 구분해서 이 차이를 드러내지 못한다.
     */
    @Column(nullable = false, length = 64, columnDefinition = "VARCHAR(64) COLLATE utf8mb4_bin")
    @Comment("공유 토큰 (SecureRandom 32바이트의 URL-safe Base64, 43자). 대소문자를 구분해야 하므로 utf8mb4_bin")
    private String token;

    @Column(nullable = false)
    @Comment("만료 시각 (발급 시각 + 30일)")
    private LocalDateTime expiresAt;

    @Comment("폐기 시각. null 이면 유효한 링크다 (행을 지우지 않고 닫는다)")
    private LocalDateTime revokedAt;
}
