package com.hondigagae.domainlayer.insight.adapter.out.persistence;

import com.hondigagae.common.geo.GeoDistance;
import com.hondigagae.domainlayer.insight.adapter.out.persistence.repository.PlaceProfileRepository;
import com.hondigagae.domainlayer.insight.application.mapper.InsightMapper;
import com.hondigagae.domainlayer.insight.application.model.AlternativePlaceCriteria;
import com.hondigagae.domainlayer.insight.application.port.out.PlaceProfileQueryPort;
import com.hondigagae.domainlayer.insight.domain.model.PlaceCondition;
import com.hondigagae.domainlayer.place.adapter.out.persistence.entity.PlaceEntity;
import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PlaceProfilePersistenceAdapter implements PlaceProfileQueryPort {

    private final PlaceProfileRepository placeProfileRepository;
    private final InsightMapper insightMapper;

    @Override
    public Optional<PlaceCondition> findProfile(long placeId) {
        // findById 는 병합으로 값이 흡수된 행도 돌려준다. 상세 조회와 같은 기준으로 거른다.
        return placeProfileRepository.findByIdAndMergedIntoIdIsNull(placeId)
            // 병합으로 사라진 행은 없는 것으로 본다. place 상세 조회와 같은 규칙이다.
            .filter(entity -> entity.getMergedIntoId() == null)
            .map(insightMapper::toPlaceConditionFromEntity);
    }

    @Override
    public List<PlaceCondition> findIndoorAlternatives(AlternativePlaceCriteria criteria) {
        double latDelta = GeoDistance.latDelta(criteria.radiusMeters());
        double lngDelta = GeoDistance.lngDelta(criteria.radiusMeters(), criteria.lat());

        return placeProfileRepository.findIndoorWithinBox(
                BigDecimal.valueOf(criteria.lat() - latDelta),
                BigDecimal.valueOf(criteria.lat() + latDelta),
                BigDecimal.valueOf(criteria.lng() - lngDelta),
                BigDecimal.valueOf(criteria.lng() + lngDelta),
                criteria.excludePlaceId()
            ).stream()
            // 사각 범위를 정확한 원형 반경으로 다듬고 가까운 순으로 자른다
            // (place-data-integration.md §9-2 와 같은 방식).
            .filter(entity -> withinRadius(entity, criteria))
            .sorted(Comparator.comparingDouble(entity -> distanceMeters(entity, criteria)))
            .limit(criteria.size())
            .map(insightMapper::toPlaceConditionFromEntity)
            .toList();
    }

    private boolean withinRadius(PlaceEntity entity, AlternativePlaceCriteria criteria) {
        return distanceMeters(entity, criteria) <= criteria.radiusMeters();
    }

    private double distanceMeters(PlaceEntity entity, AlternativePlaceCriteria criteria) {
        return GeoDistance.meters(
            criteria.lat(), criteria.lng(), entity.getLat().doubleValue(), entity.getLng().doubleValue());
    }
}
