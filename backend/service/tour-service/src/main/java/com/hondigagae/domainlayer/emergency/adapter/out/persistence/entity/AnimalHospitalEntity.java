package com.hondigagae.domainlayer.emergency.adapter.out.persistence.entity;

import com.hondigagae.persistence.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

/**
 * 동물병원. 여행 장소가 아니라 긴급 상황용 시설이라 place 와 테이블을 나눈다.
 *
 * <p>원천은 문화정보원 CSV 다. 제주 225행 중 이름·주소·좌표가 같은 중복이 139건이라
 * source_key(이름+주소 해시) UK 로 실제 86곳이 남는다.
 */
@Entity
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Table(
    name = "animal_hospital",
    indexes = {
        @Index(name = "uk_animal_hospital_source_key", columnList = "sourceKey", unique = true),
        // 반경 검색은 좌표 범위로 먼저 좁힌다
        @Index(name = "idx_animal_hospital_lat_lng", columnList = "lat,lng"),
        @Index(name = "idx_animal_hospital_open24", columnList = "open24")
    }
)
public class AnimalHospitalEntity extends BaseEntity {

    @Id
    @Comment("동물병원 아이디")
    private Long id;

    @Column(nullable = false, length = 64)
    @Comment("원천 식별자 (시설명+주소 해시)")
    private String sourceKey;

    @Column(nullable = false, length = 200)
    @Comment("병원명")
    private String name;

    @Column(length = 200)
    @Comment("주소")
    private String addr;

    @Column(length = 6)
    @Comment("관광 시군구코드 (제주시=4, 서귀포시=3)")
    private String sigunguCode;

    @Column(precision = 13, scale = 10)
    @Comment("위도")
    private BigDecimal lat;

    @Column(precision = 13, scale = 10)
    @Comment("경도")
    private BigDecimal lng;

    @Column(length = 50)
    @Comment("전화번호")
    private String tel;

    @Column(length = 300)
    // 작은따옴표는 Hibernate 가 이스케이프하지 않아 comment DDL 이 깨진다. 코멘트에 넣지 않는다.
    @Comment("운영시간. 원천이 정보없음으로 주는 경우가 절반이라 null 을 허용한다")
    private String operatingHours;

    @Column(length = 200)
    @Comment("휴무일")
    private String restDate;

    @Column(nullable = false)
    @Comment("24시간 운영 여부. 상호에 24시가 있거나 운영시간이 00:00~24:00 인 경우만 true")
    private boolean open24;

    @Comment("원천 수정일")
    private LocalDateTime sourceModifiedAt;

    @Column(nullable = false)
    @Comment("적재 시각")
    private LocalDateTime syncedAt;
}
