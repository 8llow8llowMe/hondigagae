package com.hondigagae.domainlayer.place.adapter.out.persistence.repository;

import com.hondigagae.domainlayer.place.adapter.out.persistence.entity.PlaceIntroEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlaceIntroRepository extends JpaRepository<PlaceIntroEntity, Long> {

    Optional<PlaceIntroEntity> findByPlaceId(Long placeId);
}
