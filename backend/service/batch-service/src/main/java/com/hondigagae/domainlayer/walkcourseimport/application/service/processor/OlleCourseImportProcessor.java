package com.hondigagae.domainlayer.walkcourseimport.application.service.processor;

import com.hondigagae.domainlayer.walkcourseimport.application.port.out.OlleCourseCatalogPort;
import com.hondigagae.domainlayer.walkcourseimport.application.port.out.OlleCourseCoordinatePort;
import com.hondigagae.domainlayer.walkcourseimport.application.port.out.WalkCourseBulkPort;
import com.hondigagae.domainlayer.walkcourseimport.application.port.out.query.OlleCourseCoordinateQueryResult;
import com.hondigagae.domainlayer.walkcourseimport.domain.model.ImportedWalkCourse;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 제주올레 코스 적재.
 *
 * <p>공식 수치는 CSV 가, 좌표·이미지는 TourAPI 가 낸다. <b>CSV 가 기준 목록</b>이다 -
 * TourAPI 에만 있는 항목(하영올레 등)은 코스가 되지 않고, CSV 에 있는데 TourAPI 에 없는
 * 코스(20·18-2)는 좌표 없이 적재된다. 매칭 실패를 실패로 다루지 않는 이유는 그 코스도
 * 거리·소요시간·시종점만으로 목록에 설 자격이 있어서다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OlleCourseImportProcessor {

    private final OlleCourseCatalogPort olleCourseCatalogPort;
    private final OlleCourseCoordinatePort olleCourseCoordinatePort;
    private final WalkCourseBulkPort walkCourseBulkPort;

    public int importCourses() {
        List<ImportedWalkCourse> courses = olleCourseCatalogPort.loadCourses();
        Map<String, OlleCourseCoordinateQueryResult> coordinates =
            olleCourseCoordinatePort.fetchCoordinatesByCourseKey();

        List<ImportedWalkCourse> merged = courses.stream()
            .map(course -> merge(course, coordinates.get(course.courseKey())))
            .toList();

        long unmatched = merged.stream().filter(course -> course.lat() == null).count();
        if (unmatched > 0) {
            // 어떤 코스가 좌표 없이 남았는지 로그에 남긴다 - TourAPI 에 항목이 늘면 재실행만으로 채워진다.
            log.info("olle courses without coordinates: {}", merged.stream()
                .filter(course -> course.lat() == null)
                .map(ImportedWalkCourse::courseKey)
                .toList());
        }

        int upserted = walkCourseBulkPort.upsertAll(merged);
        log.info("olle course import finished. courses={}, coordinateMatched={}, upserted={}",
            merged.size(), merged.size() - unmatched, upserted);
        return upserted;
    }

    private ImportedWalkCourse merge(ImportedWalkCourse course, OlleCourseCoordinateQueryResult coordinate) {
        if (coordinate == null) {
            return course;
        }
        return course.withCoordinate(coordinate.lat(), coordinate.lng(), coordinate.contentId(), coordinate.firstImage());
    }
}
