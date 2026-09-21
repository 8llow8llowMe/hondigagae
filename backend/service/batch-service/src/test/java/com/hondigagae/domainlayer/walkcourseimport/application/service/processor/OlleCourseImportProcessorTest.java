package com.hondigagae.domainlayer.walkcourseimport.application.service.processor;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.walkcourseimport.application.port.out.OlleCourseCatalogPort;
import com.hondigagae.domainlayer.walkcourseimport.application.port.out.OlleCourseCoordinatePort;
import com.hondigagae.domainlayer.walkcourseimport.application.port.out.WalkCourseBulkPort;
import com.hondigagae.domainlayer.walkcourseimport.application.port.out.query.OlleCourseCoordinateQueryResult;
import com.hondigagae.domainlayer.walkcourseimport.domain.model.ImportedWalkCourse;
import java.math.BigDecimal;
import java.nio.file.Path;
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
        OlleCourseCatalogPort catalog = path -> List.of(course("1"), course("20"));
        OlleCourseCoordinatePort coordinates = () -> Map.of(
            "1", OlleCourseCoordinateQueryResult.builder()
                .lat(33.4796d).lng(126.8955d).contentId(126273L).firstImage("http://image").build(),
            // CSV 에 없는 TourAPI 항목은 코스가 되지 않는다
            "99", OlleCourseCoordinateQueryResult.builder().lat(33.0d).lng(126.0d).build());
        OlleCourseImportProcessor processor = new OlleCourseImportProcessor(catalog, coordinates, bulkPort());

        var imported = processor.importCourses(Path.of("unused.csv"));

        assertThat(imported).hasSize(2);
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

    /**
     * 종점 좌표는 <b>시작점 매칭이 끝난 뒤에</b> 채워져야 한다 (#816). 순서가 뒤집히면 색인이
     * 빈 좌표 위에서 만들어져 전부 null 로 나가는데, 그래도 배치는 성공으로 끝나므로 아무것도
     * 알려 주지 않는다 - #722 가 오래 보이지 않았던 것과 같은 모양이다.
     */
    @Test
    @DisplayName("좌표를 붙인 다음 종점을 잇는다 - 인접 코스의 시작점이 앞 코스의 종점이 된다")
    void endCoordinateIsChainedAfterCoordinateMatching() {
        OlleCourseCatalogPort catalog = path -> List.of(
            course("1", "시흥리정류장", "광치기해변"),
            course("2", "광치기해변", "온평포구"));
        OlleCourseCoordinatePort coordinates = () -> Map.of(
            "1", OlleCourseCoordinateQueryResult.builder().lat(33.4796d).lng(126.8955d).build(),
            "2", OlleCourseCoordinateQueryResult.builder().lat(33.4457d).lng(126.9223d).build());
        OlleCourseImportProcessor processor = new OlleCourseImportProcessor(catalog, coordinates, bulkPort());

        processor.importCourses(Path.of("unused.csv"));

        ImportedWalkCourse first = upserted.stream()
            .filter(course -> course.courseKey().equals("1")).findFirst().orElseThrow();
        assertThat(first.endLat()).isEqualTo(33.4457d);
        assertThat(first.endLng()).isEqualTo(126.9223d);
        // 2코스 종점 온평포구에서 출발하는 코스가 이 목록에 없다 - 지어내지 않는다
        ImportedWalkCourse second = upserted.stream()
            .filter(course -> course.courseKey().equals("2")).findFirst().orElseThrow();
        assertThat(second.endLat()).isNull();
    }

    private WalkCourseBulkPort bulkPort() {
        return courses -> {
            upserted.addAll(courses);
            return courses.size();
        };
    }

    private static ImportedWalkCourse course(String courseNo) {
        return course(courseNo, "시점", "종점");
    }

    private static ImportedWalkCourse course(String courseNo, String startPointName, String endPointName) {
        return ImportedWalkCourse.builder()
            .id(Long.parseLong(courseNo))
            .courseKey(courseNo)
            .courseNo(courseNo)
            .courseOrder(Integer.parseInt(courseNo) * 10)
            .name("코스" + courseNo)
            .distanceKm(new BigDecimal("15.1"))
            .durationText("4~5시간")
            .durationMaxMinutes(300)
            .startEndPoint(startPointName + "-" + endPointName)
            .startPointName(startPointName)
            .endPointName(endPointName)
            .baseDate("2025-04-28")
            .build();
    }
}
