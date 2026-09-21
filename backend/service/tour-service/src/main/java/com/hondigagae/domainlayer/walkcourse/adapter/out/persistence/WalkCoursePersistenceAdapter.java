package com.hondigagae.domainlayer.walkcourse.adapter.out.persistence;

import com.hondigagae.domainlayer.walkcourse.adapter.out.persistence.entity.WalkCourseEntity;
import com.hondigagae.domainlayer.walkcourse.adapter.out.persistence.repository.WalkCourseRepository;
import com.hondigagae.domainlayer.walkcourse.application.port.out.WalkCourseRepositoryPort;
import com.hondigagae.domainlayer.walkcourse.application.port.out.query.WalkCourseQueryResult;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class WalkCoursePersistenceAdapter implements WalkCourseRepositoryPort {

    private final WalkCourseRepository walkCourseRepository;

    @Override
    public List<WalkCourseQueryResult> findAll() {
        return walkCourseRepository.findAll().stream()
            .map(this::toQueryResult)
            .toList();
    }

    @Override
    public Optional<WalkCourseQueryResult> findById(long walkCourseId) {
        return walkCourseRepository.findById(walkCourseId).map(this::toQueryResult);
    }

    /** 빈 컬렉션이면 즉시 끊는다 - 쿼리로 내려가면 {@code in ()} 가 나간다. */
    @Override
    public List<WalkCourseQueryResult> findByIds(Collection<Long> walkCourseIds) {
        if (walkCourseIds.isEmpty()) {
            return List.of();
        }
        return walkCourseRepository.findByIdIn(walkCourseIds).stream()
            .map(this::toQueryResult)
            .toList();
    }

    private WalkCourseQueryResult toQueryResult(WalkCourseEntity entity) {
        return WalkCourseQueryResult.builder()
            .walkCourseId(entity.getId())
            .courseNo(entity.getCourseNo())
            .variant(entity.getVariant())
            .courseOrder(entity.getCourseOrder())
            .name(entity.getName())
            .distanceKm(entity.getDistanceKm())
            .durationText(entity.getDurationText())
            .durationMaxMinutes(entity.getDurationMaxMinutes())
            .startEndPoint(entity.getStartEndPoint())
            .startPointName(entity.getStartPointName())
            .endPointName(entity.getEndPointName())
            .lat(entity.getLat())
            .lng(entity.getLng())
            .endLat(entity.getEndLat())
            .endLng(entity.getEndLng())
            .firstImage(entity.getFirstImage())
            .baseDate(entity.getBaseDate())
            .build();
    }
}
