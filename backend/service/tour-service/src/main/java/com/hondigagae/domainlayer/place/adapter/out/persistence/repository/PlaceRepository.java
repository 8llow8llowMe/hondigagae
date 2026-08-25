package com.hondigagae.domainlayer.place.adapter.out.persistence.repository;

import com.hondigagae.domainlayer.place.adapter.out.persistence.entity.PlaceEntity;
import com.hondigagae.domainlayer.place.domain.enums.PetAllowanceType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PlaceRepository extends JpaRepository<PlaceEntity, Long> {

    @Query("""
        select p from PlaceEntity p
        where (:areaCode is null or p.areaCode = :areaCode)
          and (:sigunguCode is null or p.sigunguCode = :sigunguCode)
          and (:contentTypeId is null or p.contentTypeId = :contentTypeId)
          and (:petAllowanceType is null or p.petAllowanceType = :petAllowanceType)
          and (:lastPlaceId is null or p.id < :lastPlaceId)
        order by p.id desc
        """)
    Slice<PlaceEntity> findAllByCriteria(
        @Param("areaCode") String areaCode, @Param("sigunguCode") String sigunguCode,
        @Param("contentTypeId") String contentTypeId, @Param("petAllowanceType") PetAllowanceType petAllowanceType,
        @Param("lastPlaceId") Long lastPlaceId, Pageable pageable
    );
}
