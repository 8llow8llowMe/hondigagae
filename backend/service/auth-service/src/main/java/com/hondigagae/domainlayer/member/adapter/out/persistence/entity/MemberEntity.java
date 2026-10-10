package com.hondigagae.domainlayer.member.adapter.out.persistence.entity;

import com.hondigagae.domainlayer.member.domain.enums.MemberStatus;
import com.hondigagae.domainlayer.member.domain.enums.OAuthProvider;
import com.hondigagae.persistence.entity.BaseEntity;
import com.hondigagae.security.common.enums.SecurityRole;
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

@Entity
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PROTECTED)
@Table(
    name = "member",
    indexes = {
        // 동시 가입 요청에서 중복 계정이 생기지 않도록 DB 수준 unique 제약을 둔다.
        @Index(name = "uk_member_email", columnList = "email", unique = true)
    })
public class MemberEntity extends BaseEntity {

    @Id
    @Comment("회원 아이디")
    private Long id;

    @Comment("이메일")
    @Column(length = 100, nullable = false)
    private String email;

    @Comment("비밀번호")
    @Column(length = 80)
    private String password;

    @Comment("이름")
    @Column(length = 30, nullable = false)
    private String name;

    @Comment("닉네임")
    @Column(length = 30, nullable = false)
    private String nickname;

    @Comment("소셜 제공자가 준 외부 프로필 이미지 URL (직접 업로드한 경우 null)")
    @Column(length = 500)
    private String profileImageUrl;

    @Comment("직접 업로드한 프로필 이미지 오브젝트 키 (URL 이 아니라 키를 저장한다)")
    @Column(length = 512)
    private String profileImageKey;

    @Comment("권한")
    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private SecurityRole role;

    @Comment("소셜 로그인 제공자 (null이면 일반 계정)")
    @Column(length = 20)
    @Enumerated(EnumType.STRING)
    private OAuthProvider provider;

    @Comment("회원 상태")
    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private MemberStatus status;

    @Comment("탈퇴 시각 (ACTIVE 회원은 null) - 보존 기간(30일) 경과 판정 기준")
    @Column(columnDefinition = "TIMESTAMP")
    private LocalDateTime withdrawnAt;
}
