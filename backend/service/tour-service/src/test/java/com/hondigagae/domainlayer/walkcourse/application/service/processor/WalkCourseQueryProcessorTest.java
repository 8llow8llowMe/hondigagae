package com.hondigagae.domainlayer.walkcourse.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hondigagae.domainlayer.walkcourse.application.exception.WalkCourseErrorCode;
import com.hondigagae.domainlayer.walkcourse.application.exception.WalkCourseException;
import com.hondigagae.domainlayer.walkcourse.application.info.WalkCourseInfo;
import com.hondigagae.domainlayer.walkcourse.application.model.WalkCourseSearchQuery;
import com.hondigagae.domainlayer.walkcourse.application.port.out.WalkCourseRepositoryPort;
import com.hondigagae.domainlayer.walkcourse.application.port.out.query.WalkCourseQueryResult;
import com.hondigagae.domainlayer.walkcourse.domain.enums.WalkCourseSort;
import com.hondigagae.domainlayer.walkcourse.domain.model.WalkCourseActivityFit;
import com.hondigagae.shared.travel.pet.ActivityLevel;
import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 산책 코스 조회 (#382).
 *
 * <p>활동량 필터는 "장시간 활동을 힘들어하는" 아이에게 6~7시간 코스를 권하지 않기 위한 것이다.
 * 상한의 단일 출처는 {@code WalkCourseActivityFit} 이고, 이 테스트가 그 경계를 고정한다.
 */
class WalkCourseQueryProcessorTest {

    // 실데이터 모양 그대로 - 가파도(1~2시간), 1코스(4~5시간), 3코스A(6~7시간), 좌표 없는 20코스(5~6시간)
    private final WalkCourseQueryProcessor processor = new WalkCourseQueryProcessor(new StubPort(List.of(
        course(3, "3", "A", 30, "20.9", "6~7시간", 420),
        course(1, "1", null, 10, "15.1", "4~5시간", 300),
        course(101, "10-1", null, 101, "4.2", "1~2시간", 120),
        course(20, "20", null, 200, "17.6", "5~6시간", 360)
    )));

    @Test
    @DisplayName("기본 정렬은 코스번호 순이다 - 번호가 곧 사용자가 아는 이름이다")
    void sortsByCourseNumberByDefault() {
        List<WalkCourseInfo> courses = processor.search(WalkCourseSearchQuery.builder().build());

        assertThat(courses).extracting(WalkCourseInfo::walkCourseId).containsExactly(1L, 3L, 101L, 20L);
    }

    @Test
    @DisplayName("활동량 LOW 는 4시간 이하 코스만 남는다 - 장시간 활동을 힘들어하는 아이에게 6시간 코스를 권하지 않는다")
    void lowActivityKeepsShortCoursesOnly() {
        List<WalkCourseInfo> courses = processor.search(
            WalkCourseSearchQuery.builder().petActivityLevel(ActivityLevel.LOW).build());

        // 4~5시간(상한 300분) 코스도 빠진다 - 상한이 240분이다
        assertThat(courses).extracting(WalkCourseInfo::walkCourseId).containsExactly(101L);
    }

    @Test
    @DisplayName("활동량 MEDIUM 은 6시간 이하까지, HIGH 는 거르지 않는다")
    void mediumAndHighBands() {
        List<WalkCourseInfo> medium = processor.search(
            WalkCourseSearchQuery.builder().petActivityLevel(ActivityLevel.MEDIUM).build());
        List<WalkCourseInfo> high = processor.search(
            WalkCourseSearchQuery.builder().petActivityLevel(ActivityLevel.HIGH).build());

        assertThat(medium).extracting(WalkCourseInfo::walkCourseId).containsExactly(1L, 101L, 20L);
        assertThat(high).hasSize(4);
    }

    @Test
    @DisplayName("최대 거리와 거리 정렬이 함께 동작한다")
    void filtersByDistanceAndSorts() {
        List<WalkCourseInfo> courses = processor.search(WalkCourseSearchQuery.builder()
            .maxDistanceKm(new BigDecimal("16.0"))
            .sort(WalkCourseSort.DISTANCE_ASC)
            .build());

        assertThat(courses).extracting(WalkCourseInfo::walkCourseId).containsExactly(101L, 1L);
    }

    @Test
    @DisplayName("없는 코스는 WALKCOURSE_001 이다")
    void unknownCourseRejected() {
        assertThatThrownBy(() -> processor.getDetail(999L))
            .isInstanceOf(WalkCourseException.class)
            .extracting(exception -> ((WalkCourseException) exception).getErrorCode())
            .isEqualTo(WalkCourseErrorCode.NOT_FOUND_WALK_COURSE);
    }

    @Test
    @DisplayName("코스 이름표는 변형이 있으면 괄호로 붙는다")
    void courseLabelCarriesVariant() {
        assertThat(processor.getDetail(3L).courseLabel()).isEqualTo("3코스 (A)");
        assertThat(processor.getDetail(101L).courseLabel()).isEqualTo("10-1코스");
    }

    // ── 아이디 벌크 조회 (일정 항목 요약, #619) ───────────────────────────────

    @Test
    @DisplayName("아이디 목록으로 코스 요약을 한 번에 주고, 코스번호 순으로 세운다")
    void candidatesComeBackInCourseOrder() {
        List<WalkCourseInfo> courses = processor.getCandidates(List.of(20L, 1L, 3L));

        assertThat(courses).extracting(WalkCourseInfo::walkCourseId).containsExactly(1L, 3L, 20L);
    }

    @Test
    @DisplayName("없는 아이디는 조용히 빠진다 — getDetail 과 달리 예외를 던지지 않는다")
    void candidatesSkipUnknownIdsSilently() {
        List<WalkCourseInfo> courses = processor.getCandidates(List.of(1L, 999L));

        assertThat(courses).extracting(WalkCourseInfo::walkCourseId).containsExactly(1L);
    }

    @Test
    @DisplayName("빈 입력은 빈 목록이다")
    void candidatesOfEmptyInputAreEmpty() {
        assertThat(processor.getCandidates(List.of())).isEmpty();
    }

    @Test
    @DisplayName("활동량 힌트가 목록 필터와 같은 상한을 쓴다 — 목록에 나오는데 힌트에 없는 코스가 없다")
    void fitHintMatchesListFilter() {
        for (WalkCourseInfo course : processor.getCandidates(List.of(1L, 3L, 101L, 20L))) {
            for (ActivityLevel level : ActivityLevel.values()) {
                assertThat(course.fitActivityLevels().contains(level))
                    .as("코스 %d / %s", course.walkCourseId(), level)
                    .isEqualTo(WalkCourseActivityFit.fits(level, course.durationMaxMinutes()));
            }
        }
    }

    @Test
    @DisplayName("소요시간을 모르는 코스는 활동량 세 값이 다 담긴다 — 지우지 않는다")
    void unknownDurationFitsEveryLevel() {
        WalkCourseInfo unknown = new WalkCourseQueryProcessor(new StubPort(List.of(
            course(7, "7", null, 70, "17.6", "미상", null)))).getCandidates(List.of(7L)).get(0);

        assertThat(unknown.durationMaxMinutes()).isNull();
        assertThat(unknown.fitActivityLevels())
            .containsExactly(ActivityLevel.LOW, ActivityLevel.MEDIUM, ActivityLevel.HIGH);
    }

    private static WalkCourseQueryResult course(
        long id, String courseNo, String variant, int order, String distanceKm, String durationText, Integer maxMinutes
    ) {
        return WalkCourseQueryResult.builder()
            .walkCourseId(id)
            .courseNo(courseNo)
            .variant(variant)
            .courseOrder(order)
            .name("코스" + courseNo)
            .distanceKm(new BigDecimal(distanceKm))
            .durationText(durationText)
            .durationMaxMinutes(maxMinutes)
            .startEndPoint("시점-종점")
            .lat("20".equals(courseNo) ? null : 33.4d)
            .lng("20".equals(courseNo) ? null : 126.5d)
            .baseDate("2025-04-28")
            .build();
    }

    private record StubPort(List<WalkCourseQueryResult> courses) implements WalkCourseRepositoryPort {

        @Override
        public List<WalkCourseQueryResult> findAll() {
            return courses;
        }

        @Override
        public List<WalkCourseQueryResult> findByIds(Collection<Long> walkCourseIds) {
            if (walkCourseIds.isEmpty()) {
                return List.of();
            }
            return courses.stream()
                .filter(course -> walkCourseIds.contains(course.walkCourseId()))
                .toList();
        }

        @Override
        public Optional<WalkCourseQueryResult> findById(long walkCourseId) {
            return courses.stream().filter(course -> course.walkCourseId() == walkCourseId).findFirst();
        }
    }
}
