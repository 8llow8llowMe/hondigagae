package com.hondigagae.domainlayer.emergency.adapter.out.persistence;

import com.hondigagae.domainlayer.emergency.adapter.out.persistence.entity.EmergencyFacilityEntity;
import com.hondigagae.domainlayer.emergency.adapter.out.persistence.repository.EmergencyFacilityRepository;
import com.hondigagae.domainlayer.emergency.application.model.NearbyFacilityQuery;
import com.hondigagae.domainlayer.emergency.application.port.out.EmergencyFacilityRepositoryPort;
import com.hondigagae.domainlayer.emergency.application.port.out.query.EmergencyFacilityQueryResult;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class EmergencyFacilityPersistenceAdapter implements EmergencyFacilityRepositoryPort {

    private final EmergencyFacilityRepository emergencyFacilityRepository;

    @Override
    public List<EmergencyFacilityQueryResult> findWithinBox(NearbyFacilityQuery query) {
        return emergencyFacilityRepository.searchWithinBox(query).stream()
            .map(this::toQueryResult)
            .toList();
    }

    @Override
    public Optional<EmergencyFacilityQueryResult> findById(long facilityId) {
        return emergencyFacilityRepository.findByIdAndDelistedAtIsNull(facilityId)
            .map(this::toQueryResult);
    }

    private EmergencyFacilityQueryResult toQueryResult(EmergencyFacilityEntity entity) {
        return EmergencyFacilityQueryResult.builder()
            .facilityId(entity.getId())
            .facilityType(entity.getFacilityType())
            .name(entity.getName())
            .addr(entity.getAddr())
            .lat(entity.getLat())
            .lng(entity.getLng())
            .tel(entity.getTel())
            .operatingHours(entity.getOperatingHours())
            .weeklyHoursSpec(entity.getWeeklyHoursSpec())
            .restDate(entity.getRestDate())
            .open24(entity.isOpen24())
            .build();
    }
}
