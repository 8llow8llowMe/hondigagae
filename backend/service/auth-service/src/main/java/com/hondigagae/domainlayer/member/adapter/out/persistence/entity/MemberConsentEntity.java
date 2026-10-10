package com.hondigagae.domainlayer.member.adapter.out.persistence.entity;

import com.hondigagae.domainlayer.member.domain.enums.ConsentType;
import com.hondigagae.persistence.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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

/**
 * 회원 동의 이력. 회원당 항목당 여러 행이 쌓인다(문서 개정 시 재동의) — 그래서
 * {@code (memberId, type)} 에 unique 를 걸지 않는다. 최신 동의는 {@code agreedAt} 최대값이다.
 */
@Entity
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PROTECTED)
@Table(
    name = "member_consent",
    indexes = {
        @Index(name = "idx_member_consent_member_id", columnList = "memberId")
    })
public class MemberConsentEntity extends BaseEntity {

    @Id
    @Comment("동의 이력 아이디 (Snowflake)")
    private Long id;

    @Column(nullable = false)
    @Comment("회원 아이디 (FK: member.id)")
    private Long memberId;

    @Column(nullable = false, length = 30)
    @Enumerated(EnumType.STRING)
    @Comment("동의·확인 항목 (TERMS_OF_SERVICE/PRIVACY_POLICY/AGE_OVER_14) - AGE_OVER_14 는 문서 동의가 아니라 자기신고 확인이라 철회 대상이 아니다")
    private ConsentType type;

    @Column(nullable = false, length = 20)
    @Comment("근거 문서의 버전 - 정본은 프론트 legal 상수, 백엔드는 legal.*-version 설정으로 맞춘다. AGE_OVER_14 는 만 14세 기준을 규정하는 이용약관 버전을 박는다")
    private String documentVersion;

    @Column(nullable = false)
    @Comment("동의 시각 - createdAt 과 별도로 둔다. 감사 대상은 행이 생긴 시각이 아니라 동의한 시각이다")
    private LocalDateTime agreedAt;
}
