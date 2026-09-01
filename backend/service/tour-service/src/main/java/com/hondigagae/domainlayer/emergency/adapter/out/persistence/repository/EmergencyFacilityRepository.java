package com.hondigagae.domainlayer.emergency.adapter.out.persistence.repository;

import com.hondigagae.domainlayer.emergency.adapter.out.persistence.entity.EmergencyFacilityEntity;
import com.hondigagae.domainlayer.emergency.adapter.out.persistence.repository.custom.EmergencyFacilityCustomRepository;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** 반경 검색은 {@link EmergencyFacilityCustomRepository}(QueryDSL) 쪽이다. */
public interface EmergencyFacilityRepository
    extends JpaRepository<EmergencyFacilityEntity, Long>, EmergencyFacilityCustomRepository {

    /**
     * 내려가지 않은 시설 단건.
     *
     * <p>delisted 조건을 메서드 이름에 넣어 <b>빠뜨릴 수 없게</b> 한다. findById 를 그대로 쓰면
     * 폐업 표시된 시설도 상세로는 보이는데, 목록에는 없는 곳이라 사용자가 그 주소를 들고
     * 급하게 찾아가게 된다.
     */
    Optional<EmergencyFacilityEntity> findByIdAndDelistedAtIsNull(long facilityId);
}
