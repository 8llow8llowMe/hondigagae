package com.hondigagae.domainlayer.walkcourseimport.application.service.processor;

import com.hondigagae.domainlayer.walkcourseimport.application.port.out.OlleCourseCatalogPort;
import com.hondigagae.domainlayer.walkcourseimport.application.port.out.OlleCourseCoordinatePort;
import com.hondigagae.domainlayer.walkcourseimport.application.port.out.WalkCourseBulkPort;
import com.hondigagae.domainlayer.walkcourseimport.application.port.out.query.OlleCourseCoordinateQueryResult;
import com.hondigagae.domainlayer.walkcourseimport.domain.model.ImportedWalkCourse;
import com.hondigagae.domainlayer.walkcourseimport.domain.model.OlleCourseEndpointResolver;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 제주올레 코스 적재.
 *
 * <p>공식 수치는 CSV 가, 좌표·이미지는 TourAPI 가 낸다. <b>CSV 가 기준 목록</b>이다 -
 * TourAPI 에만 있는 항목(하영올레 등)은 코스가 되지 않고, 좌표를 못 붙인 코스는 좌표 없이
 * 적재된다. 매칭 실패를 실패로 다루지 않는 이유는 그 코스도 거리·소요시간·시종점만으로 목록에
 * 설 자격이 있어서다.
 *
 * <p><b>다만 그 관용 때문에 #722 가 오래 보이지 않았다.</b> 29개 중 25개가 좌표 없이 적재돼도
 * 배치는 성공으로 끝났다. 원인은 원천 결손이 아니라 조회·파싱 결함이었고 - 구 {@code areaCode=39}
 * 조회와 변형(A/B) 제목을 못 읽는 정규식 - 20·18-2 를 포함해 29개 모두 TourAPI 응답에 있다.
 * 결함을 고친 뒤에는 29개 전부 좌표가 붙는다. 좌표 없는 코스가 남으면 원천이 아니라 이 두 곳을
 * 먼저 의심한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OlleCourseImportProcessor {

    private final OlleCourseCatalogPort olleCourseCatalogPort;
    private final OlleCourseCoordinatePort olleCourseCoordinatePort;
    private final WalkCourseBulkPort walkCourseBulkPort;

    public List<ImportedWalkCourse> importCourses(Path csvFile) {
        List<ImportedWalkCourse> courses = olleCourseCatalogPort.loadCourses(csvFile);
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

        // 종점 좌표는 새 원천 없이 인접 코스의 시작점에서 끌어온다 (#816). 시작점 매칭이 끝난 뒤라야 한다.
        List<ImportedWalkCourse> resolved = OlleCourseEndpointResolver.resolveEndCoordinates(merged);
        long endUnmatched = resolved.stream().filter(course -> course.endLat() == null).count();
        if (endUnmatched > 0) {
            // 그 지점에서 출발하는 코스가 없어 닿지 않는 종점이다 - 원천 결손이 아니라 체이닝의 한계다.
            log.info("olle courses without end coordinates: {}", resolved.stream()
                .filter(course -> course.endLat() == null)
                .map(course -> course.courseKey() + "(" + course.endPointName() + ")")
                .toList());
        }

        int upserted = walkCourseBulkPort.upsertAll(resolved);
        log.info("olle course import finished. courses={}, coordinateMatched={}, endCoordinateMatched={}, upserted={}",
            resolved.size(), resolved.size() - unmatched, resolved.size() - endUnmatched, upserted);
        return resolved;
    }

    private ImportedWalkCourse merge(ImportedWalkCourse course, OlleCourseCoordinateQueryResult coordinate) {
        if (coordinate == null) {
            return course;
        }
        return course.withCoordinate(coordinate.lat(), coordinate.lng(), coordinate.contentId(), coordinate.firstImage());
    }
}
