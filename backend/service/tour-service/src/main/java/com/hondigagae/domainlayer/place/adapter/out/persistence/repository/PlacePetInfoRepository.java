package com.hondigagae.domainlayer.place.adapter.out.persistence.repository;

import com.hondigagae.domainlayer.place.adapter.out.persistence.entity.PlacePetInfoEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlacePetInfoRepository extends JpaRepository<PlacePetInfoEntity, Long> {

    Optional<PlacePetInfoEntity> findByPlaceId(Long placeId);
}
