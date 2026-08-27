package com.hondigagae.domainlayer.insight.adapter.out.persistence.repository;

import com.hondigagae.domainlayer.insight.adapter.out.persistence.entity.CongestionForecastEntity;
import com.hondigagae.domainlayer.insight.domain.enums.NameLinkSourceType;
import com.hondigagae.domainlayer.insight.domain.enums.NameMatchType;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CongestionForecastRepository extends JpaRepository<CongestionForecastEntity, Long> {

    /**
     * 장소에 연결된 집중률 예측을 날짜 범위로 가져온다.
     *
     * <p>{@code place_name_link} 를 거쳐 잇는다. JPA 연관관계를 쓰지 않는 규칙(coding-conventions
     * §9-1)에 따라 조인 어노테이션 대신 두 엔티티를 나열하고 where 로 묶는다.
     *
     * <p>매칭 실패 링크를 제외하는 조건이 중요하다. UNMATCHED 행이 남아 있어도 그 행을 타고
     * 엉뚱한 장소의 혼잡도가 붙어서는 안 된다.
     */
    @Query("""
        select c from CongestionForecastEntity c, PlaceNameLinkEntity l
        where l.placeId = :placeId
          and l.sourceType = :sourceType
          and l.matchType <> :unmatched
          and c.areaCd = l.areaCd
          and c.signguCd = l.signguCd
          and c.tatsNm = l.tatsNm
          and c.baseYmd between :fromYmd and :toYmd
        order by c.baseYmd asc
        """)
    List<CongestionForecastEntity> findByPlaceIdAndDateRange(
        @Param("placeId") long placeId, @Param("fromYmd") String fromYmd, @Param("toYmd") String toYmd,
        @Param("sourceType") NameLinkSourceType sourceType, @Param("unmatched") NameMatchType unmatched
    );
}
