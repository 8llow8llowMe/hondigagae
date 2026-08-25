package com.hondigagae.domainlayer.place.adapter.out.persistence.repository;

import com.hondigagae.domainlayer.place.adapter.out.persistence.entity.PlaceImageEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlaceImageRepository extends JpaRepository<PlaceImageEntity, Long> {

    List<PlaceImageEntity> findAllByPlaceIdOrderBySerialNumAsc(Long placeId);
}
