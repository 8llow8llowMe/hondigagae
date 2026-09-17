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

    /**
     * 코스 차례. <b>사용자가 말하는 "코스번호 순"이지만 실제 키는 {@code courseOrder} 다</b> -
     * {@code courseNo} 는 문자열이라 "10" 이 "2" 앞에 서고, 변형(A/B)은 번호에 들어 있지 않다.
     * 목록·상세·내부 요약이 같은 차례로 서야 해서 정본을 여기 하나만 둔다.
     */
    private static final Comparator<WalkCourseInfo> BY_COURSE =
        Comparator.comparingInt(WalkCourseInfo::courseOrder)
            .thenComparing(course -> course.variant() == null ? "" : course.variant());

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
     * 아이디 목록으로 코스 요약을 <b>한 번에</b> 준다 (plan-service 의 일정 항목 요약용).
     *
     * <p>{@link #getDetail} 과 달리 <b>없는 아이디에 예외를 던지지 않는다.</b> 소비처는 일정
     * 항목마다 코스를 붙이는 자리이고, plan-service 의 {@code WALK} {@code targetId} 는 저장 시
     * 검증되지 않는다 - 그런 아이디 하나에 실패하면 일정 전체가 안 보인다. 빠진 코스는 그쪽에서
     * 요약 없는 항목으로 남는다.
     *
     * <p>{@link #BY_COURSE} 차례로 세워 준다. 소비처가 아이디로 맵을 만들더라도, 순서가 요청마다
     * 흔들리는 응답을 내보내지 않는다.
     */
    public List<WalkCourseInfo> getCandidates(List<Long> walkCourseIds) {
        return walkCourseRepositoryPort.findByIds(walkCourseIds).stream()
            .map(WalkCourseInfo::from)
            .sorted(BY_COURSE)
            .toList();
    }

    /**
     * 정렬. 어느 기준이든 <b>{@link #BY_COURSE} 를 마지막 타이브레이크</b>로 둔다 - 같은 거리의
     * 코스가 요청마다 다른 순서로 서면 사용자는 목록이 바뀌었다고 읽는다.
     */
    private Comparator<WalkCourseInfo> comparatorOf(WalkCourseSearchQuery query) {
        return switch (query.resolvedSort()) {
            case COURSE_NO -> BY_COURSE;
            case DISTANCE_ASC -> Comparator.comparing(WalkCourseInfo::distanceKm).thenComparing(BY_COURSE);
            case DISTANCE_DESC -> Comparator.comparing(WalkCourseInfo::distanceKm).reversed().thenComparing(BY_COURSE);
            // 소요시간을 모르는 코스는 뒤로 보낸다 - 지우지도, 0분으로 앞세우지도 않는다
            case DURATION_ASC -> Comparator.comparing(WalkCourseInfo::durationMaxMinutes,
                Comparator.nullsLast(Comparator.naturalOrder())).thenComparing(BY_COURSE);
        };
    }
}
