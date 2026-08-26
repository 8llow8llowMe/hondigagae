package com.hondigagae.domainlayer.place.adapter.out.persistence.entity;

import com.hondigagae.domainlayer.place.domain.enums.AllowedPetSize;
import com.hondigagae.domainlayer.place.domain.enums.PetAllowanceType;
import com.hondigagae.domainlayer.place.domain.enums.PlaceSource;
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
        // 원천이 둘 이상이라 고유 키는 (source, sourceKey) 다. contentId 는 TourAPI 전용이라 일반 인덱스로 둔다.
        @Index(name = "uk_place_source_source_key", columnList = "source,sourceKey", unique = true),
        @Index(name = "idx_place_content_id", columnList = "contentId"),
        @Index(name = "idx_place_area_code_sigungu_code_content_type_id", columnList = "areaCode,sigunguCode,contentTypeId"),
        @Index(name = "idx_place_content_type_id_pet_available", columnList = "contentTypeId,petAvailable"),
        // 비 오는 날 실내 대안 추천 경로
        @Index(name = "idx_place_indoor_pet_available", columnList = "indoor,petAvailable"),
        @Index(name = "idx_place_source_category", columnList = "sourceCategory"),
        @Index(name = "idx_place_lat_lng", columnList = "lat,lng"),
        @Index(name = "idx_place_source_modified_at", columnList = "sourceModifiedAt"),
        // 병합된 행은 조회에서 제외하므로 필터 컬럼에 인덱스를 둔다
        @Index(name = "idx_place_merged_into_id", columnList = "mergedIntoId")
    }
)
public class PlaceEntity extends BaseEntity {

    @Id
    @Comment("장소 아이디 (Snowflake)")
    private Long id;

    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    @Comment("장소 원천 (TOUR_API / CULTURE_PORTAL)")
    private PlaceSource source;

    @Column(nullable = false, length = 64)
    @Comment("원천 식별자 — TourAPI 는 contentId, 문화정보원은 시설명+주소 해시")
    private String sourceKey;

    @Column(length = 50)
    @Comment("원천의 원본 분류 (문화정보원 카테고리3: 펜션·카페·박물관 등). contentTypeId 로 뭉개기 전 값을 보존한다")
    private String sourceCategory;

    @Comment("TourAPI 콘텐츠 아이디 (문화정보원 원천이면 null)")
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

    // 원천이 실내외를 알려주지 않는 경우(관광 API)와 "실외다"를 구분해야 하므로 wrapper 로 둔다.
    // false 로 뭉개면 관광 API 장소 29곳이 전부 "실외"로 잘못 표시된다.
    @Comment("실내 장소 여부 — 비 오는 날 대안 추천의 근거. null 이면 원천에 정보가 없다")
    private Boolean indoor;

    @Comment("실외 장소 여부. null 이면 원천에 정보가 없다")
    private Boolean outdoor;

    @Column(nullable = false)
    @Comment("반려동물 전용 시설 여부")
    private boolean petOnly;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Comment("입장 가능 반려동물 크기 (가공값)")
    private AllowedPetSize allowedPetSize;

    @Column(length = 500)
    @Comment("반려동물 제한사항 원문")
    private String petRestriction;

    @Column(length = 200)
    @Comment("반려동물 동반 추가 요금 원문")
    private String petExtraFee;

    @Comment("중복 병합 시 살아남은 장소 아이디 (FK: place.id). 값이 있으면 조회에서 제외한다")
    private Long mergedIntoId;

    @Comment("원천 등록일 (createdtime)")
    private LocalDateTime sourceCreatedAt;

    @Comment("원천 수정일 (modifiedtime) — 증분 동기화 기준")
    private LocalDateTime sourceModifiedAt;

    @Column(nullable = false)
    @Comment("적재 시각")
    private LocalDateTime syncedAt;
}
