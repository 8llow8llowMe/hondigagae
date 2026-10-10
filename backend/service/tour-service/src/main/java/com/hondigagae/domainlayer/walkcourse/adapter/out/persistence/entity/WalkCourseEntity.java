package com.hondigagae.domainlayer.walkcourse.adapter.out.persistence.entity;

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
 * 제주올레 산책 코스. 장소(place)가 아니라 <b>걷는 길</b>이라 테이블을 나눈다.
 *
 * <p>원천은 둘을 결합한다 - 공식 수치(거리·소요시간·시종점)는 공공데이터포털
 * "제주특별자치도 올레코스현황" CSV 가 단일 출처이고, 시작점 좌표·대표이미지는 TourAPI
 * 레포츠(28) 의 올레 항목을 코스번호로 매칭해 얹는다. 두루누비를 쓰지 않는 이유는
 * 걷기 코스 142개가 코리아둘레길 축이라 <b>제주가 0개</b>이기 때문이다 (#382).
 *
 * <p>좌표가 null 인 코스가 있다(20·18-2코스는 TourAPI 에 없다). 지어내지 않고 비워 둔다 -
 * 좌표가 있는 코스만 골든타임(walk-times)과 이어진다.
 *
 * <p><b>경로 좌표열(폴리라인) 컬럼은 없다.</b> 그것을 주는 공개 원천이 없기 때문이고, 네 곳을
 * 전수 조사한 근거가 {@code backend/docs/data-api-analysis.md} §9 에 있다 (#736). 대신
 * {@code endLat}/{@code endLng} 로 <b>시작점과 종점 두 점</b>까지는 준다 - 적재가 인접 코스의
 * 시작점에서 끌어온 값이다 (#816).
 */
@Entity
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Table(
    name = "walk_course",
    indexes = {
        // 재적재(upsert)의 자연키. "3-A" 처럼 코스번호와 변형(A/B)을 합친 값이다
        @Index(name = "uk_walk_course_course_key", columnList = "courseKey", unique = true),
        @Index(name = "idx_walk_course_course_order", columnList = "courseOrder")
    }
)
public class WalkCourseEntity extends BaseEntity {

    @Id
    @Comment("산책 코스 아이디 (Snowflake)")
    private Long id;

    @Column(nullable = false, length = 20)
    @Comment("코스 자연키 (코스번호[-변형]. 예: 1, 1-1, 3-A)")
    private String courseKey;

    @Column(nullable = false, length = 10)
    @Comment("코스번호 원문 (1, 1-1, 18-2)")
    private String courseNo;

    @Column(length = 2)
    @Comment("변형 구분 (A/B). 없으면 null")
    private String variant;

    @Column(nullable = false)
    @Comment("정렬 순서 (본번호*10 + 부번호. 1코스=10, 1-1코스=11)")
    private int courseOrder;

    @Column(nullable = false, length = 100)
    @Comment("코스명 (시흥-광치기)")
    private String name;

    @Column(nullable = false, precision = 5, scale = 1)
    @Comment("거리 (km)")
    private BigDecimal distanceKm;

    @Column(nullable = false, length = 20)
    @Comment("소요시간 원문 (4~5시간)")
    private String durationText;

    @Comment("소요시간 상한(분). 원문을 파싱하지 못하면 null - 지어내지 않는다")
    private Integer durationMaxMinutes;

    @Column(nullable = false, length = 100)
    @Comment("시종점 원문 (시흥리정류장-광치기해변)")
    private String startEndPoint;

    @Column(length = 50)
    @Comment("시작 지점명 (시흥리정류장). 시종점 원문을 가른 것이고 표기는 원문 그대로다")
    private String startPointName;

    @Column(length = 50)
    @Comment("종점 지점명 (광치기해변). 시종점 원문을 가른 것이고 표기는 원문 그대로다")
    private String endPointName;

    @Comment("시작점 위도 (WGS84). TourAPI 매칭 실패 코스는 null")
    private Double lat;

    @Comment("시작점 경도 (WGS84). TourAPI 매칭 실패 코스는 null")
    private Double lng;

    @Comment("종점 위도 (WGS84). 그 지점에서 출발하는 코스가 없어 못 찾은 코스는 null")
    private Double endLat;

    @Comment("종점 경도 (WGS84). 그 지점에서 출발하는 코스가 없어 못 찾은 코스는 null")
    private Double endLng;

    @Comment("TourAPI contentId. 매칭 실패 코스는 null")
    private Long contentId;

    @Column(length = 512)
    @Comment("대표 이미지 URL. TourAPI 매칭 실패 코스는 null")
    private String firstImage;

    @Column(nullable = false, length = 10)
    @Comment("원천 데이터 기준일자 (yyyy-MM-dd)")
    private String baseDate;

    @Column(nullable = false)
    @Comment("적재 시각")
    private LocalDateTime syncedAt;
}
