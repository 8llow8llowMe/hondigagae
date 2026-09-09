package com.hondigagae.domainlayer.walkcourse.adapter.out.persistence;

import com.hondigagae.domainlayer.walkcourse.adapter.out.persistence.entity.WalkCourseEntity;
import com.hondigagae.domainlayer.walkcourse.adapter.out.persistence.repository.WalkCourseRepository;
import com.hondigagae.domainlayer.walkcourse.application.port.out.WalkCourseRepositoryPort;
import com.hondigagae.domainlayer.walkcourse.application.port.out.query.WalkCourseQueryResult;
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
            .lat(entity.getLat())
            .lng(entity.getLng())
            .firstImage(entity.getFirstImage())
            .baseDate(entity.getBaseDate())
            .build();
    }
}
