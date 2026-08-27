package com.hondigagae.domainlayer.insight.adapter.out.persistence.repository;

import com.hondigagae.domainlayer.place.adapter.out.persistence.entity.PlaceEntity;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * insight 전용 장소 질의.
 *
 * <p>place 컨텍스트의 {@code PlaceEntity} 를 다시 매핑하지 않고 그대로 읽는다. 같은 서비스
 * 안에서 테이블 하나를 두 벌로 매핑하면 컬럼이 늘 때 한쪽만 고치는 사고가 난다.
 * 계층 규칙상 문제가 되는 방향(application 이 adapter 를 아는 것)이 아니라
 * adapter 끼리의 재사용이다.
 */
public interface PlaceProfileRepository extends JpaRepository<PlaceEntity, Long> {

    /**
     * 반경 사각 범위 안에서 <b>실내가 확인된</b> 동반 가능 장소.
     *
     * <p>{@code p.indoor = true} 로 못박은 것이 요점이다. {@code indoor is null} 인 장소
     * (식약처 원천 102곳)는 실내인지 알 수 없으므로 비 오는 날 대안이 될 수 없다.
     * 정확한 원형 반경과 거리 정렬은 조회 뒤 애플리케이션이 한다.
     */
    @Query("""
        select p from PlaceEntity p
        where p.mergedIntoId is null
          and p.id <> :excludePlaceId
          and p.indoor = true
          and p.petAvailable = true
          and p.lat between :minLat and :maxLat
          and p.lng between :minLng and :maxLng
        """)
    List<PlaceEntity> findIndoorWithinBox(
        @Param("minLat") BigDecimal minLat, @Param("maxLat") BigDecimal maxLat,
        @Param("minLng") BigDecimal minLng, @Param("maxLng") BigDecimal maxLng,
        @Param("excludePlaceId") long excludePlaceId
    );
}
