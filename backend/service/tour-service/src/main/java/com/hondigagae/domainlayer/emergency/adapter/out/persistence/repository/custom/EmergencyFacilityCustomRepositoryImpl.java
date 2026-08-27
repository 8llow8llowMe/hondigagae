package com.hondigagae.domainlayer.emergency.adapter.out.persistence.repository.custom;

import com.hondigagae.common.geo.GeoDistance;
import com.hondigagae.domainlayer.emergency.adapter.out.persistence.entity.EmergencyFacilityEntity;
import com.hondigagae.domainlayer.emergency.adapter.out.persistence.entity.QEmergencyFacilityEntity;
import com.hondigagae.domainlayer.emergency.application.model.NearbyFacilityQuery;
import com.querydsl.core.BooleanBuilder;
import com.querydsl.jpa.impl.JPAQueryFactory;
import java.math.BigDecimal;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class EmergencyFacilityCustomRepositoryImpl implements EmergencyFacilityCustomRepository {

    private static final QEmergencyFacilityEntity facility = QEmergencyFacilityEntity.emergencyFacilityEntity;

    private final JPAQueryFactory queryFactory;

    @Override
    public List<EmergencyFacilityEntity> searchWithinBox(NearbyFacilityQuery query) {
        double latDelta = GeoDistance.latDelta(query.radius());
        double lngDelta = GeoDistance.lngDelta(query.radius(), query.lat());

        BooleanBuilder where = new BooleanBuilder()
            .and(facility.delistedAt.isNull())
            .and(facility.lat.between(
                BigDecimal.valueOf(query.lat() - latDelta), BigDecimal.valueOf(query.lat() + latDelta)))
            .and(facility.lng.between(
                BigDecimal.valueOf(query.lng() - lngDelta), BigDecimal.valueOf(query.lng() + lngDelta)));

        if (query.facilityType() != null) {
            where.and(facility.facilityType.eq(query.facilityType()));
        }
        if (query.open24Only()) {
            where.and(facility.open24.isTrue());
        }

        return queryFactory.selectFrom(facility).where(where).fetch();
    }
}
