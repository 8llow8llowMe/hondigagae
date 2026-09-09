package com.hondigagae.domainlayer.walkcourse.application.service.processor;

import com.hondigagae.domainlayer.walkcourse.application.exception.WalkCourseErrorCode;
import com.hondigagae.domainlayer.walkcourse.application.exception.WalkCourseException;
import com.hondigagae.domainlayer.walkcourse.application.info.WalkCourseInfo;
import com.hondigagae.domainlayer.walkcourse.application.model.WalkCourseSearchQuery;
import com.hondigagae.domainlayer.walkcourse.application.port.out.WalkCourseRepositoryPort;
import com.hondigagae.domainlayer.walkcourse.domain.model.WalkCourseActivityFit;
import java.util.Comparator;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 산책 코스 조회.
 *
 * <p>코스는 29개 안팎의 고정 소량이라 전부 가져와 메모리에서 거르고 정렬한다. 쿼리로 거르면
 * 필터마다 인덱스와 커스텀 리포지터리가 늘어나는데, 이 크기에서는 그 비용이 이득보다 크다.
 */
@Component
@RequiredArgsConstructor
public class WalkCourseQueryProcessor {

    private final WalkCourseRepositoryPort walkCourseRepositoryPort;

    public List<WalkCourseInfo> search(WalkCourseSearchQuery query) {
        return walkCourseRepositoryPort.findAll().stream()
            .map(WalkCourseInfo::from)
            .filter(course -> WalkCourseActivityFit.fits(query.petActivityLevel(), course.durationMaxMinutes()))
            .filter(course -> query.maxDistanceKm() == null
                || course.distanceKm().compareTo(query.maxDistanceKm()) <= 0)
            .sorted(comparatorOf(query))
            .toList();
    }

    public WalkCourseInfo getDetail(long walkCourseId) {
        return walkCourseRepositoryPort.findById(walkCourseId)
            .map(WalkCourseInfo::from)
            .orElseThrow(() -> new WalkCourseException(WalkCourseErrorCode.NOT_FOUND_WALK_COURSE));
    }

    /**
     * 정렬. 어느 기준이든 <b>코스번호를 마지막 타이브레이크</b>로 둔다 - 같은 거리의 코스가
     * 요청마다 다른 순서로 서면 사용자는 목록이 바뀌었다고 읽는다.
     */
    private Comparator<WalkCourseInfo> comparatorOf(WalkCourseSearchQuery query) {
        Comparator<WalkCourseInfo> byCourse = Comparator.comparingInt(WalkCourseInfo::courseOrder)
            .thenComparing(course -> course.variant() == null ? "" : course.variant());
        return switch (query.resolvedSort()) {
            case COURSE_NO -> byCourse;
            case DISTANCE_ASC -> Comparator.comparing(WalkCourseInfo::distanceKm).thenComparing(byCourse);
            case DISTANCE_DESC -> Comparator.comparing(WalkCourseInfo::distanceKm).reversed().thenComparing(byCourse);
            // 소요시간을 모르는 코스는 뒤로 보낸다 - 지우지도, 0분으로 앞세우지도 않는다
            case DURATION_ASC -> Comparator.comparing(WalkCourseInfo::durationMaxMinutes,
                Comparator.nullsLast(Comparator.naturalOrder())).thenComparing(byCourse);
        };
    }
}
