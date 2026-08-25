package com.hondigagae.domainlayer.member.adapter.out.persistence.entity;

import com.hondigagae.domainlayer.member.domain.enums.MemberStatus;
import com.hondigagae.persistence.entity.BaseEntity;
import com.hondigagae.security.common.enums.SecurityRole;
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
    name = "member",
    indexes = {
        // 동시 로그인 요청에서 중복 계정이 생기지 않도록 DB 수준 unique 제약을 둔다.
        @Index(name = "uk_member_kakao_id", columnList = "kakaoId", unique = true)
    })
public class MemberEntity extends BaseEntity {

    @Id
    @Comment("회원 아이디 (Snowflake)")
    private Long id;

    @Comment("카카오 회원번호")
    @Column(nullable = false)
    private Long kakaoId;

    @Comment("이메일 (카카오 동의 항목 — 미동의 시 null)")
    @Column(length = 100)
    private String email;

    @Comment("닉네임")
    @Column(length = 30, nullable = false)
    private String nickname;

    @Comment("카카오가 준 외부 프로필 이미지 URL")
    @Column(length = 500)
    private String profileImageUrl;

    @Comment("권한")
    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    private SecurityRole role;

    @Comment("회원 상태")
    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    private MemberStatus status;
}
