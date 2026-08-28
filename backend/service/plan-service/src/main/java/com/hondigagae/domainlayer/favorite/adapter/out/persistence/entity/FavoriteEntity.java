package com.hondigagae.domainlayer.favorite.adapter.out.persistence.entity;

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

@Entity
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PROTECTED)
@Table(
    name = "favorite",
    indexes = {
        @Index(name = "uk_favorite_member_id_place_id", columnList = "memberId,placeId", unique = true)
    }
)
@Comment("장소 즐겨찾기")
public class FavoriteEntity extends BaseEntity {

    @Id
    @Comment("즐겨찾기 아이디 (Snowflake — 시간순이라 최근 저장순 정렬에 그대로 쓴다)")
    private Long id;

    @Column(nullable = false)
    @Comment("회원 아이디 (FK: member.id)")
    private Long memberId;

    @Column(nullable = false)
    @Comment("장소 아이디 (FK: place.id, tour-service 원천)")
    private Long placeId;
}
