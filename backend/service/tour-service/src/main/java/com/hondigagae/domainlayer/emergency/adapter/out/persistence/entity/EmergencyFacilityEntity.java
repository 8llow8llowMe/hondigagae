package com.hondigagae.domainlayer.emergency.adapter.out.persistence.entity;

import com.hondigagae.domainlayer.emergency.domain.enums.EmergencyFacilityType;
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

/**
 * 긴급 시설(동물병원·동물약국). 여행 장소가 아니라 급할 때 찾는 곳이라 place 와 테이블을 나눈다.
 *
 * <p>종류를 나눠 한 테이블에 담는 이유는 급할 때 필요한 것이 "가장 가까운 도움"이지
 * "가장 가까운 병원"이 아니어서다. 거리로 함께 정렬해야 그 질문에 답할 수 있다.
 *
 * <p>원천은 문화정보원 CSV 다. 이름·주소·좌표가 통째로 같은 중복이 많아
 * source_key(시설명+주소 해시) UK 로 정리된다 — 제주 기준 841행이 214곳으로 줄어든다
 * (동물병원 225 -> 86, 동물약국 616 -> 128).
 */
@Entity
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Table(
    name = "emergency_facility",
    indexes = {
        @Index(name = "uk_emergency_facility_source_key", columnList = "sourceKey", unique = true),
        // 반경 검색은 좌표 범위로 먼저 좁힌다
        @Index(name = "idx_emergency_facility_lat_lng", columnList = "lat,lng"),
        @Index(name = "idx_emergency_facility_open24", columnList = "open24"),
        @Index(name = "idx_emergency_facility_type", columnList = "facilityType")
    }
)
public class EmergencyFacilityEntity extends BaseEntity {

    @Id
    @Comment("긴급 시설 아이디")
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Comment("시설 종류 (동물병원/동물약국)")
    private EmergencyFacilityType facilityType;

    @Column(nullable = false, length = 64)
    @Comment("원천 식별자 (시설명+주소 해시)")
    private String sourceKey;

    @Column(nullable = false, length = 200)
    @Comment("시설명")
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

    @Column(length = 300)
    @Comment("구조화된 주간 영업시간(WeeklySchedule spec). null 이면 원문을 풀 수 없었던 곳 — 영업 여부를 모름으로 본다")
    private String weeklyHoursSpec;

    @Column(nullable = false)
    @Comment("24시간 운영 여부. 상호에 24시가 있거나 운영시간이 00:00~24:00 인 경우만 true")
    private boolean open24;

    @Comment("원천 수정일")
    private LocalDateTime sourceModifiedAt;

    @Column(nullable = false)
    @Comment("적재 시각")
    private LocalDateTime syncedAt;

    @Comment("원천에서 사라진 시각. 값이 있으면 조회에서 제외한다")
    private LocalDateTime delistedAt;
}
