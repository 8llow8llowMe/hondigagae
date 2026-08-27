package com.hondigagae.domainlayer.insight.adapter.out.persistence.entity;

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

/**
 * 관광지 집중률 예측 (TatsCnctrRateService, 30일 rolling).
 *
 * <p>원천이 <b>장소 ID 가 아니라 관광지 명칭</b>으로 온다. 그래서 place 와 직접 FK 를 걸 수 없고
 * {@link PlaceNameLinkEntity} 를 거쳐 이어 붙인다. 이 한 단계가 없으면 이름이 조금만 달라도
 * 데이터가 통째로 유실된다.
 *
 * <p>30일 rolling 이라 단기예보(3일)보다 커버리지가 넓다. 날씨는 없고 혼잡도만 있는 날짜가
 * 흔하며, 적합도 응답은 그 차이를 감추지 않는다.
 */
@Entity
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Table(
    name = "congestion_forecast",
    indexes = {
        @Index(name = "uk_congestion_forecast_base_ymd_area_cd_signgu_cd_tats_nm",
            columnList = "baseYmd,areaCd,signguCd,tatsNm", unique = true),
        @Index(name = "idx_congestion_forecast_area_cd_signgu_cd_tats_nm",
            columnList = "areaCd,signguCd,tatsNm")
    }
)
public class CongestionForecastEntity extends BaseEntity {

    @Id
    @Comment("집중률 예측 아이디")
    private Long id;

    @Column(nullable = false, length = 8)
    @Comment("예측 대상 일자 (yyyyMMdd)")
    private String baseYmd;

    @Column(nullable = false, length = 10)
    @Comment("법정동 시도 코드 (제주=50)")
    private String areaCd;

    @Column(nullable = false, length = 10)
    @Comment("법정동 시군구 코드 (제주시=50110, 서귀포시=50130)")
    private String signguCd;

    @Column(nullable = false, length = 200)
    @Comment("원천 관광지 명칭. place 와는 place_name_link 를 거쳐 연결한다")
    private String tatsNm;

    @Column(nullable = false)
    @Comment("집중률 (0~100). NOT NULL 이라 primitive 다 (coding-conventions §9-2)")
    private double cnctrRate;

    @Column(nullable = false)
    @Comment("적재 시각")
    private LocalDateTime syncedAt;
}
