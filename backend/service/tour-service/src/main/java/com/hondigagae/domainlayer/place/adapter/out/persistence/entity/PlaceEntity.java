package com.hondigagae.domainlayer.place.adapter.out.persistence.entity;

import com.hondigagae.domainlayer.place.domain.enums.PetAllowanceType;
import com.hondigagae.persistence.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.math.BigDecimal;
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
    name = "place",
    indexes = {
        @Index(name = "uk_place_content_id", columnList = "contentId", unique = true),
        @Index(name = "idx_place_area_code_sigungu_code_content_type_id", columnList = "areaCode,sigunguCode,contentTypeId"),
        @Index(name = "idx_place_content_type_id_pet_available", columnList = "contentTypeId,petAvailable"),
        @Index(name = "idx_place_lat_lng", columnList = "lat,lng"),
        @Index(name = "idx_place_source_modified_at", columnList = "sourceModifiedAt")
    }
)
public class PlaceEntity extends BaseEntity {

    @Id
    @Comment("장소 아이디 (Snowflake)")
    private Long id;

    @Column(nullable = false)
    @Comment("TourAPI 콘텐츠 아이디")
    private Long contentId;

    @Column(nullable = false, length = 2)
    @Comment("콘텐츠 타입 (12 관광지, 32 숙박, 39 음식점 등)")
    private String contentTypeId;

    @Column(nullable = false, length = 200)
    @Comment("장소명")
    private String title;

    @Column(length = 200)
    @Comment("주소")
    private String addr1;

    @Column(length = 100)
    @Comment("상세주소")
    private String addr2;

    @Column(length = 10)
    @Comment("우편번호")
    private String zipcode;

    @Column(length = 4)
    @Comment("관광 지역코드 (제주=39)")
    private String areaCode;

    @Column(length = 6)
    @Comment("관광 시군구코드")
    private String sigunguCode;

    @Column(length = 2)
    @Comment("법정동 시도코드 (제주=50)")
    private String ldongRegnCd;

    @Column(length = 4)
    @Comment("법정동 시군구코드 (제주시=110, 서귀포시=130)")
    private String ldongSignguCd;

    @Column(length = 4)
    @Comment("구 카테고리 대분류")
    private String cat1;

    @Column(length = 6)
    @Comment("구 카테고리 중분류")
    private String cat2;

    @Column(length = 10)
    @Comment("구 카테고리 소분류")
    private String cat3;

    @Column(length = 4)
    @Comment("신 분류체계 대분류")
    private String lclsSystm1;

    @Column(length = 6)
    @Comment("신 분류체계 중분류")
    private String lclsSystm2;

    @Column(length = 10)
    @Comment("신 분류체계 소분류")
    private String lclsSystm3;

    @Column(precision = 13, scale = 10)
    @Comment("위도 (원천 mapy)")
    private BigDecimal lat;

    @Column(precision = 13, scale = 10)
    @Comment("경도 (원천 mapx)")
    private BigDecimal lng;

    @Comment("지도 레벨")
    private Integer mlevel;

    @Column(length = 300)
    @Comment("대표 이미지 원본 URL")
    private String firstImage;

    @Column(length = 300)
    @Comment("대표 이미지 썸네일 URL")
    private String firstImage2;

    @Column(length = 10)
    @Comment("저작권 유형 (Type1/Type3 — 출처표기 의무)")
    private String cpyrhtDivCd;

    @Column(length = 100)
    @Comment("전화번호")
    private String tel;

    @Column(columnDefinition = "TEXT")
    @Comment("홈페이지 (HTML anchor 포함 원문)")
    private String homepage;

    @Column(columnDefinition = "TEXT")
    @Comment("개요")
    private String overview;

    @Column(nullable = false)
    @Comment("반려동물 동반 콘텐츠 여부")
    private boolean petAvailable;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Comment("반려동물 동반 구분 (가공값)")
    private PetAllowanceType petAllowanceType;

    @Comment("원천 등록일 (createdtime)")
    private LocalDateTime sourceCreatedAt;

    @Comment("원천 수정일 (modifiedtime) — 증분 동기화 기준")
    private LocalDateTime sourceModifiedAt;

    @Column(nullable = false)
    @Comment("적재 시각")
    private LocalDateTime syncedAt;
}
