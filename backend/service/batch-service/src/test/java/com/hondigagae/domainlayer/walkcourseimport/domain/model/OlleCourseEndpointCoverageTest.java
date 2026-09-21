package com.hondigagae.domainlayer.walkcourseimport.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.walkcourseimport.adapter.out.file.OlleCourseCsvAdapter;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * 원천 29행 전량에 대해 <b>종점 좌표가 몇 개나 채워지는지</b>를 고정한다 (#816).
 *
 * <p>여기서 재는 것은 좌표값이 아니라 <b>지점명 그래프의 모양</b>이다. 코스마다 서로 다른
 * 가짜 시작점 좌표를 주고, 어느 코스가 종점 좌표를 받고 어느 코스가 못 받는지만 본다 —
 * 실제 좌표는 TourAPI 가 주므로 단위 테스트가 가질 수 없고, 가질 필요도 없다.
 *
 * <p><b>왜 원천 CSV 를 그대로 넣어 두는가.</b> "24/29" 는 이 이슈의 결론이자 PR·문서가 적어 둔
 * 수치인데, 원천이 코스를 늘리거나 시종점 표기를 바꾸면 조용히 달라진다. 합성 데이터로는
 * 그 변화가 잡히지 않는다. 이 파일이 갱신될 때 이 테스트가 같이 깨져야 문서의 수치도 함께
 * 손보게 된다. {@code backend/data/olle_course.csv} 는 git 에 없는 우회용 파일이라 여기에
 * 사본을 둔다 — 공공데이터포털 "제주특별자치도_올레코스현황_20250428" 원문이다.
 */
class OlleCourseEndpointCoverageTest {

    private static final String CSV_RESOURCE = "/walkcourseimport/olle-course-20250428.csv";

    /**
     * 이어지는 코스가 없어 종점 좌표를 못 받는 다섯. <b>결함이 아니라 노선 구조</b>다 —
     * 7·9·21코스는 다음 코스가 다른 곳에서 시작하고, 10-1(가파도)·14-1(서광)은 지선이라
     * 종점에서 이어 걷는 코스가 없다.
     *
     * <p>7코스는 아깝게 빠진 경우다. 종점 {@code 월평아왜낭목쉼터} 와 8코스 시작
     * {@code 월평아왜낭목} 은 같은 들머리로 보이지만, 부분일치로 접으면 "○○포구"류가 줄줄이
     * 엮이므로 접지 않는다 ({@code OlleCourseParser.pointNameKey}).
     */
    private static final List<String> COURSES_WITHOUT_END_COORDINATE = List.of("7", "9", "21", "10-1", "14-1");

    @TempDir
    Path tempDir;

    @Test
    @DisplayName("29개 중 24개가 인접 코스에서 종점 좌표를 받는다 - 못 받는 다섯은 노선 구조상 정상이다")
    void twentyFourOfTwentyNineCoursesGetAnEndCoordinate() throws IOException {
        List<ImportedWalkCourse> resolved = OlleCourseEndpointResolver.resolveEndCoordinates(withFakeStartPoints());

        assertThat(resolved).hasSize(29);
        assertThat(resolved.stream().filter(course -> course.endLat() != null)).hasSize(24);
        assertThat(resolved.stream().filter(course -> course.endLat() == null))
            .extracting(ImportedWalkCourse::courseKey)
            .containsExactlyInAnyOrderElementsOf(COURSES_WITHOUT_END_COORDINATE);
    }

    @Test
    @DisplayName("공백만 다른 두 쌍이 실제 원천에서 이어진다 - 접지 않으면 4·20코스 시작점이 고아가 된다")
    void whitespaceVariantsChainInTheRealSource() throws IOException {
        List<ImportedWalkCourse> resolved = OlleCourseEndpointResolver.resolveEndCoordinates(withFakeStartPoints());

        // 3코스 종점 "제주민속촌주차장입구" ← 4코스 시작 "제주민속촌주차장 입구"
        assertThat(endCoordinateOf(resolved, "3-A")).isEqualTo(startCoordinateOf(resolved, "4"));
        assertThat(endCoordinateOf(resolved, "3-B")).isEqualTo(startCoordinateOf(resolved, "4"));
        // 19코스 종점 "김녕 서포구" ← 20코스 시작 "김녕서포구"
        assertThat(endCoordinateOf(resolved, "19")).isEqualTo(startCoordinateOf(resolved, "20"));
    }

    @Test
    @DisplayName("우도 1-1 은 순환이라 종점이 자기 시작점이고, 추자 18-1·18-2 는 서로의 시종점을 준다")
    void circularAndReversedCoursesResolve() throws IOException {
        List<ImportedWalkCourse> resolved = OlleCourseEndpointResolver.resolveEndCoordinates(withFakeStartPoints());

        assertThat(endCoordinateOf(resolved, "1-1")).isEqualTo(startCoordinateOf(resolved, "1-1"));
        assertThat(endCoordinateOf(resolved, "18-1")).isEqualTo(startCoordinateOf(resolved, "18-2"));
        assertThat(endCoordinateOf(resolved, "18-2")).isEqualTo(startCoordinateOf(resolved, "18-1"));
    }

    @Test
    @DisplayName("29행 전부 시종점을 두 지점명으로 가른다 - 못 가르는 행이 하나라도 있으면 표기가 바뀐 것이다")
    void everyRowSplitsIntoTwoPointNames() throws IOException {
        assertThat(loadSourceCourses())
            .allSatisfy(course -> {
                assertThat(course.startPointName()).isNotBlank();
                assertThat(course.endPointName()).isNotBlank();
            });
    }

    /**
     * <b>지점마다</b> 서로 다른 가짜 시작점 좌표. 코스마다가 아니라 지점마다인 것이 핵심이다 —
     * 같은 곳에서 출발하는 코스들(3-A·3-B 는 온평포구, 15-A·15-B 는 한림항, 14·14-1 은
     * 저지예술정보화마을)은 <b>실제로 같은 좌표를 받는다.</b> 코스별로 벌려 두면 같은 지점명
     * 일치 검사가 그 셋을 "어긋난 지점" 으로 버려, 코드가 아니라 픽스처 때문에 21/29 가 된다.
     *
     * <p>제주 밖 좌표를 쓰면 실좌표와 헷갈리므로 제주 범위 안에서 지점 순서만큼 벌린다.
     * 1.4km 남짓씩 떨어져 서로 다른 지점으로 읽힌다.
     */
    private List<ImportedWalkCourse> withFakeStartPoints() throws IOException {
        Map<String, Integer> pointOrder = new LinkedHashMap<>();
        List<ImportedWalkCourse> courses = loadSourceCourses();
        for (ImportedWalkCourse course : courses) {
            pointOrder.computeIfAbsent(
                OlleCourseParser.pointNameKey(course.startPointName()), ignored -> pointOrder.size());
        }
        return courses.stream()
            .map(course -> {
                int slot = pointOrder.get(OlleCourseParser.pointNameKey(course.startPointName()));
                return course.withCoordinate(33.2d + slot * 0.01d, 126.2d + slot * 0.01d, null, null);
            })
            .toList();
    }

    private List<ImportedWalkCourse> loadSourceCourses() throws IOException {
        Path csv = tempDir.resolve("olle.csv");
        try (InputStream source = Objects.requireNonNull(
            getClass().getResourceAsStream(CSV_RESOURCE), CSV_RESOURCE)) {
            Files.write(csv, source.readAllBytes());
        }
        return new OlleCourseCsvAdapter().loadCourses(csv);
    }

    private static String endCoordinateOf(List<ImportedWalkCourse> courses, String courseKey) {
        ImportedWalkCourse course = byKey(courses, courseKey);
        return course.endLat() + "," + course.endLng();
    }

    private static String startCoordinateOf(List<ImportedWalkCourse> courses, String courseKey) {
        ImportedWalkCourse course = byKey(courses, courseKey);
        return course.lat() + "," + course.lng();
    }

    private static ImportedWalkCourse byKey(List<ImportedWalkCourse> courses, String courseKey) {
        return courses.stream()
            .filter(course -> course.courseKey().equals(courseKey))
            .findFirst()
            .orElseThrow(() -> new AssertionError("코스 " + courseKey + " 가 원천에 없다"));
    }
}
