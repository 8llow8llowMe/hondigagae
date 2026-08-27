package com.hondigagae.domainlayer.emergency.adapter.out.persistence.repository;

import com.hondigagae.domainlayer.emergency.adapter.out.persistence.entity.EmergencyFacilityEntity;
import com.hondigagae.domainlayer.emergency.adapter.out.persistence.repository.custom.EmergencyFacilityCustomRepository;
import org.springframework.data.jpa.repository.JpaRepository;

/** 반경 검색은 {@link EmergencyFacilityCustomRepository}(QueryDSL) 쪽이다. */
public interface EmergencyFacilityRepository
    extends JpaRepository<EmergencyFacilityEntity, Long>, EmergencyFacilityCustomRepository {

}
