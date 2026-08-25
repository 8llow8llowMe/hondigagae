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
    name = "place_image",
    indexes = {
        @Index(name = "uk_place_image_place_id_serial_num", columnList = "placeId,serialNum", unique = true)
    }
)
public class PlaceImageEntity extends BaseEntity {

    @Id
    @Comment("장소 이미지 아이디 (Snowflake)")
    private Long id;

    @Column(nullable = false)
    @Comment("장소 아이디 (FK: place.id)")
    private Long placeId;

    @Column(nullable = false, length = 300)
    @Comment("원본 이미지 URL")
    private String originImgUrl;

    @Column(length = 300)
    @Comment("썸네일 이미지 URL")
    private String smallImageUrl;

    @Column(length = 200)
    @Comment("이미지명")
    private String imgName;

    @Column(nullable = false, length = 30)
    @Comment("원천 일련번호 (serialnum)")
    private String serialNum;

    @Column(length = 10)
    @Comment("저작권 유형")
    private String cpyrhtDivCd;

    @Column(nullable = false)
    @Comment("적재 시각")
    private LocalDateTime syncedAt;
}
