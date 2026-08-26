package com.hondigagae.domainlayer.place.adapter.out.persistence.repository;

import com.hondigagae.domainlayer.place.adapter.out.persistence.entity.PlaceEntity;
import com.hondigagae.domainlayer.place.domain.enums.AllowedPetSize;
import com.hondigagae.domainlayer.place.domain.enums.PetAllowanceType;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PlaceRepository extends JpaRepository<PlaceEntity, Long> {

    @Query("""
        select p from PlaceEntity p
        where p.mergedIntoId is null
          and (:areaCode is null or p.areaCode = :areaCode)
          and (:sigunguCode is null or p.sigunguCode = :sigunguCode)
          and (:contentTypeId is null or p.contentTypeId = :contentTypeId)
          and (:petAllowanceType is null or p.petAllowanceType = :petAllowanceType)
          and (:indoor is null or p.indoor = :indoor)
          and (:allowedPetSize is null or p.allowedPetSize = :allowedPetSize)
          and (:sourceCategory is null or p.sourceCategory = :sourceCategory)
          and (:lastPlaceId is null or p.id < :lastPlaceId)
        order by p.id desc
        """)
    Slice<PlaceEntity> findAllByCriteria(
        @Param("areaCode") String areaCode, @Param("sigunguCode") String sigunguCode,
        @Param("contentTypeId") String contentTypeId, @Param("petAllowanceType") PetAllowanceType petAllowanceType,
        @Param("indoor") Boolean indoor, @Param("allowedPetSize") AllowedPetSize allowedPetSize,
        @Param("sourceCategory") String sourceCategory,
        @Param("lastPlaceId") Long lastPlaceId, Pageable pageable
    );

    /**
     * 좌표 사각 범위로 1차 필터.
     *
     * <p>정확한 원형 반경과 거리 정렬은 조회 뒤 애플리케이션에서 계산한다. 사각 범위로 좁힌
     * 뒤 메모리에서 정렬하는 방식은 동물병원 조회와 같다 (place-data-integration.md 9-2).
     *
     * <p>좌표가 없는 장소는 애초에 반경 검색의 대상이 아니라 between 조건에서 자연히 빠진다.
     */
    @Query("""
        select p from PlaceEntity p
        where p.mergedIntoId is null
          and p.lat between :minLat and :maxLat
          and p.lng between :minLng and :maxLng
          and (:contentTypeId is null or p.contentTypeId = :contentTypeId)
          and (:petAllowanceType is null or p.petAllowanceType = :petAllowanceType)
          and (:indoor is null or p.indoor = :indoor)
          and (:allowedPetSize is null or p.allowedPetSize = :allowedPetSize)
          and (:sourceCategory is null or p.sourceCategory = :sourceCategory)
        """)
    List<PlaceEntity> findNearby(
        @Param("minLat") BigDecimal minLat, @Param("maxLat") BigDecimal maxLat,
        @Param("minLng") BigDecimal minLng, @Param("maxLng") BigDecimal maxLng,
        @Param("contentTypeId") String contentTypeId, @Param("petAllowanceType") PetAllowanceType petAllowanceType,
        @Param("indoor") Boolean indoor, @Param("allowedPetSize") AllowedPetSize allowedPetSize,
        @Param("sourceCategory") String sourceCategory
    );

    /** 병합으로 사라진 행은 상세 조회에서도 노출하지 않는다. */
    Optional<PlaceEntity> findByIdAndMergedIntoIdIsNull(long placeId);
}
