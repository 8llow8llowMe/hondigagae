package com.hondigagae.domainlayer.place.adapter.out.persistence.repository;

import com.hondigagae.domainlayer.place.adapter.out.persistence.entity.PlaceImageEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlaceImageRepository extends JpaRepository<PlaceImageEntity, Long> {

    // 갤러리 순서는 어댑터가 정한다 — serialNum 은 자릿수가 다른 숫자 문자열이라 컬럼 사전순으로는 못 세운다.
    List<PlaceImageEntity> findAllByPlaceId(Long placeId);
}
