package com.hondigagae.domainlayer.emergency.adapter.out.persistence.repository;

import com.hondigagae.domainlayer.emergency.adapter.out.persistence.entity.EmergencyFacilityEntity;
import com.hondigagae.domainlayer.emergency.domain.enums.EmergencyFacilityType;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EmergencyFacilityRepository extends JpaRepository<EmergencyFacilityEntity, Long> {

    /**
     * 좌표 사각 범위로 1차 필터.
     *
     * <p>정확한 원형 반경과 거리 정렬은 조회 뒤 애플리케이션에서 계산한다.
     * 제주 전체가 214곳뿐이라 사각 범위로 좁힌 다음 메모리에서 정렬해도 비용이 무시할 수준이고,
     * DB 함수에 삼각함수를 넣는 것보다 이식성이 좋다.
     *
     * @param facilityType null 이면 종류를 가리지 않는다
     * @param open24 null 이면 24시간 여부를 따지지 않는다
     */
    @Query("""
        select h from EmergencyFacilityEntity h
        where h.lat between :minLat and :maxLat
          and h.lng between :minLng and :maxLng
          and (:facilityType is null or h.facilityType = :facilityType)
          and (:open24 is null or h.open24 = :open24)
        """)
    List<EmergencyFacilityEntity> findWithinBox(
        @Param("minLat") BigDecimal minLat, @Param("maxLat") BigDecimal maxLat,
        @Param("minLng") BigDecimal minLng, @Param("maxLng") BigDecimal maxLng,
        @Param("facilityType") EmergencyFacilityType facilityType,
        @Param("open24") Boolean open24
    );
}
