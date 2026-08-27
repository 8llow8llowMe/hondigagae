package com.hondigagae.domainlayer.insight.adapter.out.persistence.entity;

import com.hondigagae.domainlayer.insight.domain.enums.NameLinkSourceType;
import com.hondigagae.domainlayer.insight.domain.enums.NameMatchType;
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
 * 명칭 기반 통계 API 와 장소 마스터를 잇는 연결 테이블 (entity-design.md §7).
 *
 * <p>집중률/연관 관광지 API 는 {@code contentId} 가 아니라 관광지 <b>이름</b>으로 데이터를 준다.
 * 이름은 원천마다 표기가 달라(공백, 괄호, 별칭) 직접 매칭하면 상당수가 유실된다. 매칭 결과를
 * 테이블로 남겨 두면 실패한 건이 눈에 보이고, 수동 보정도 데이터로 할 수 있다.
 *
 * <p><b>{@code placeId} 는 nullable 이다.</b> 매칭 실패를 행 자체의 부재로 표현하면 "아직
 * 시도하지 않은 것"과 "시도했지만 못 찾은 것"이 구분되지 않는다.
 */
@Entity
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Table(
    name = "place_name_link",
    indexes = {
        @Index(name = "uk_place_name_link_source_type_area_cd_signgu_cd_tats_nm",
            columnList = "sourceType,areaCd,signguCd,tatsNm", unique = true),
        @Index(name = "idx_place_name_link_place_id_source_type", columnList = "placeId,sourceType")
    }
)
public class PlaceNameLinkEntity extends BaseEntity {

    @Id
    @Comment("명칭 연결 아이디")
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Comment("원천 구분 (CONGESTION/RELATED_PLACE)")
    private NameLinkSourceType sourceType;

    @Column(nullable = false, length = 10)
    @Comment("법정동 시도 코드")
    private String areaCd;

    @Column(nullable = false, length = 10)
    @Comment("법정동 시군구 코드")
    private String signguCd;

    @Column(nullable = false, length = 200)
    @Comment("원천 관광지 명칭")
    private String tatsNm;

    @Comment("매칭된 장소 아이디 (FK: place.id). 매칭 실패를 표현하기 위해 nullable 이다")
    private Long placeId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Comment("매칭 방식 (EXACT/NORMALIZED/MANUAL/UNMATCHED)")
    private NameMatchType matchType;

    @Column(nullable = false)
    @Comment("적재 시각")
    private LocalDateTime syncedAt;
}
