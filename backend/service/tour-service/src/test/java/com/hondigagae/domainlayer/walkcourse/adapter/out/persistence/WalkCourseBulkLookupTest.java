package com.hondigagae.domainlayer.walkcourse.adapter.out.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.walkcourse.adapter.out.persistence.entity.WalkCourseEntity;
import com.hondigagae.domainlayer.walkcourse.adapter.out.persistence.repository.WalkCourseRepository;
import com.hondigagae.domainlayer.walkcourse.application.port.out.query.WalkCourseQueryResult;
import com.hondigagae.persistence.config.QuerydslConfigurer;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.test.context.TestPropertySource;

/**
 * 산책 코스 아이디 벌크 조회 (#619).
 *
 * <p>실제 스키마에 질의해 고정하는 것은 셋이다.
 * <ul>
 *   <li><b>없는 아이디는 조용히 빠진다</b> — plan-service 의 {@code WALK} {@code targetId} 는 저장 시
 *       검증되지 않아 없는 코스를 가리킬 수 있는데, 그 하나 때문에 일정 상세가 죽으면 안 된다
 *   <li><b>빈 입력은 쿼리로 내려가지 않는다</b> — {@code in ()} 로 나가면 DB 방언에 따라 문법
 *       오류다
 *   <li><b>중복 아이디는 한 행으로 온다</b> — 소비처가 아이디로 맵을 만들 때 키가 겹치지 않는다는
 *       전제를 여기서 고정한다. PK {@code in} 조회라 오늘은 참이고, 나중에 조인 기반으로 바뀌면
 *       여기서 걸린다
 * </ul>
 */
@DataJpaTest(includeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE,
    classes = WalkCourseRepository.class))
@EntityScan("com.hondigagae.domainlayer")
@EnableJpaAuditing
@Import(QuerydslConfigurer.class)
@TestPropertySource(properties = {
    "spring.cloud.config.enabled=false",
    "spring.cloud.discovery.enabled=false",
    "eureka.client.enabled=false",
    "spring.jpa.hibernate.ddl-auto=create-drop"
})
class WalkCourseBulkLookupTest {

    private static final long COURSE_1_ID = 1L;
    private static final long COURSE_3A_ID = 3L;
    /** 저장하지 않는 아이디. 검증 없이 저장된 {@code WALK} targetId 가 가리키는 없는 코스를 흉내 낸다. */
    private static final long GONE_ID = 99_999L;

    @Autowired
    private WalkCourseRepository walkCourseRepository;

    private WalkCoursePersistenceAdapter adapter;

    @BeforeEach
    void setUp() {
        adapter = new WalkCoursePersistenceAdapter(walkCourseRepository);
        walkCourseRepository.saveAll(List.of(
            course(COURSE_1_ID, "1", null, 10, "15.1", "4~5시간", 300),
            course(COURSE_3A_ID, "3", "A", 30, "20.9", "6~7시간", 420),
            // 소요시간 원문을 파싱하지 못한 코스. null 이 그대로 실려 와야 한다
            course(20L, "20", null, 200, "17.6", "미상", null)));
    }

    @Test
    @DisplayName("아이디 목록으로 한 번에 가져온다")
    void findsByIds() {
        List<WalkCourseQueryResult> courses = adapter.findByIds(List.of(COURSE_1_ID, COURSE_3A_ID));

        assertThat(courses).extracting(WalkCourseQueryResult::walkCourseId)
            .containsExactlyInAnyOrder(COURSE_1_ID, COURSE_3A_ID);
    }

    @Test
    @DisplayName("없는 아이디는 조용히 빠진다 — 예외를 던지면 그 항목 때문에 일정이 통째로 안 보인다")
    void skipsUnknownIdsSilently() {
        List<WalkCourseQueryResult> courses = adapter.findByIds(List.of(COURSE_1_ID, GONE_ID));

        assertThat(courses).extracting(WalkCourseQueryResult::walkCourseId).containsExactly(COURSE_1_ID);
    }

    @Test
    @DisplayName("같은 아이디를 두 번 물어도 한 행만 온다 — 소비처의 맵 만들기에 키 충돌이 없다")
    void duplicateIdsCollapseToOneRow() {
        List<WalkCourseQueryResult> courses = adapter.findByIds(List.of(COURSE_1_ID, COURSE_1_ID));

        assertThat(courses).extracting(WalkCourseQueryResult::walkCourseId).containsExactly(COURSE_1_ID);
    }

    @Test
    @DisplayName("빈 입력은 빈 목록이다 — in () 로 내려보내지 않는다")
    void emptyInputReturnsEmpty() {
        assertThat(adapter.findByIds(List.of())).isEmpty();
    }

    @Test
    @DisplayName("소요시간 상한이 null 인 코스도 그대로 실려 온다 — 지어내지 않는다")
    void carriesNullDurationMaxMinutes() {
        List<WalkCourseQueryResult> courses = adapter.findByIds(List.of(20L));

        assertThat(courses).hasSize(1);
        assertThat(courses.get(0).durationMaxMinutes()).isNull();
        assertThat(courses.get(0).durationText()).isEqualTo("미상");
    }

    private static WalkCourseEntity course(
        long id, String courseNo, String variant, int order, String distanceKm, String durationText, Integer maxMinutes
    ) {
        return WalkCourseEntity.builder()
            .id(id)
            .courseKey(variant == null ? courseNo : courseNo + "-" + variant)
            .courseNo(courseNo)
            .variant(variant)
            .courseOrder(order)
            .name("코스" + courseNo)
            .distanceKm(new BigDecimal(distanceKm))
            .durationText(durationText)
            .durationMaxMinutes(maxMinutes)
            .startEndPoint("시점-종점")
            .lat(33.4d)
            .lng(126.5d)
            .firstImage("https://example.test/course.jpg")
            .baseDate("2025-04-28")
            .syncedAt(LocalDateTime.now())
            .build();
    }
}
