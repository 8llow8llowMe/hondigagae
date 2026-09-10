package com.hondigagae.domainlayer.walkcourseimport.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.walkcourseimport.application.port.out.OlleCourseCatalogPort;
import com.hondigagae.domainlayer.walkcourseimport.application.port.out.OlleCourseCoordinatePort;
import com.hondigagae.domainlayer.walkcourseimport.application.port.out.WalkCourseBulkPort;
import com.hondigagae.domainlayer.walkcourseimport.application.port.out.query.OlleCourseCoordinateQueryResult;
import com.hondigagae.domainlayer.walkcourseimport.domain.model.ImportedWalkCourse;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class OlleCourseImportProcessorTest {

    private final List<ImportedWalkCourse> upserted = new ArrayList<>();

    @Test
    @DisplayName("CSV 가 기준 목록이다 - 매칭된 코스는 좌표가 붙고, TourAPI 에 없는 코스는 좌표 null 로 적재된다")
    void csvIsTheSourceListAndUnmatchedStaysWithoutCoordinate() {
        OlleCourseCatalogPort catalog = () -> List.of(course("1"), course("20"));
        OlleCourseCoordinatePort coordinates = () -> Map.of(
            "1", OlleCourseCoordinateQueryResult.builder()
                .lat(33.4796d).lng(126.8955d).contentId(126273L).firstImage("http://image").build(),
            // CSV 에 없는 TourAPI 항목은 코스가 되지 않는다
            "99", OlleCourseCoordinateQueryResult.builder().lat(33.0d).lng(126.0d).build());
        OlleCourseImportProcessor processor = new OlleCourseImportProcessor(catalog, coordinates, bulkPort());

        int count = processor.importCourses();

        assertThat(count).isEqualTo(2);
        assertThat(upserted).hasSize(2);
        ImportedWalkCourse matched = upserted.stream()
            .filter(course -> course.courseKey().equals("1")).findFirst().orElseThrow();
        assertThat(matched.lat()).isEqualTo(33.4796d);
        assertThat(matched.contentId()).isEqualTo(126273L);
        assertThat(matched.firstImage()).isEqualTo("http://image");

        ImportedWalkCourse unmatched = upserted.stream()
            .filter(course -> course.courseKey().equals("20")).findFirst().orElseThrow();
        // 지어내지 않는다 - 좌표 없는 코스도 거리·소요시간만으로 목록에 설 자격이 있다
        assertThat(unmatched.lat()).isNull();
        assertThat(unmatched.lng()).isNull();
        assertThat(unmatched.contentId()).isNull();
    }

    private WalkCourseBulkPort bulkPort() {
        return courses -> {
            upserted.addAll(courses);
            return courses.size();
        };
    }

    private static ImportedWalkCourse course(String courseNo) {
        return ImportedWalkCourse.builder()
            .id(Long.parseLong(courseNo))
            .courseKey(courseNo)
            .courseNo(courseNo)
            .courseOrder(Integer.parseInt(courseNo) * 10)
            .name("코스" + courseNo)
            .distanceKm(new BigDecimal("15.1"))
            .durationText("4~5시간")
            .durationMaxMinutes(300)
            .startEndPoint("시점-종점")
            .baseDate("2025-04-28")
            .build();
    }
}
