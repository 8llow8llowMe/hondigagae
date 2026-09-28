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
 * 원천 29행 전량에 대해 <b>종점 좌표가 몇 개나 채워지는지</b>를 판본별로 고정한다 (#816, #960).
 *
 * <p><b>2025-04-28 판</b> — 순수 체이닝({@link OlleCourseEndpointOverrides#none()})만 본다. 이 판의 목적은
 * 지점명 그래프의 모양이고, 별칭·수기 값은 2026-07-31 판 이름으로 적혀 있어 섞으면 무엇을 재는지 흐려진다.
 *
 * <p><b>2026-07-31 판</b> — dev 에서 실제로 적재한 시작점 좌표를 넣고, 확인된 별칭·수기 값
 * ({@link OlleCourseEndpointOverrides#defaults()})으로 29/29 가 채워지는지, 그것 없이는 23/29 인지 본다.
 * 수기 값에는 "시작점에서 코스 길이 안" 이라는 타당성 검사가 걸리므로 가짜 좌표로는 잴 수 없다.
 *
 * <p>2025-04-28 판에서 재는 것은 좌표값이 아니라 <b>지점명 그래프의 모양</b>이다. 지점마다 서로 다른
 * 가짜 시작점 좌표를 주고, 어느 코스가 종점 좌표를 받고 어느 코스가 못 받는지만 본다 —
 * 순수 체이닝은 좌표값에 기대지 않으므로(같은 지점명 일치 검사만 빼고) 실좌표가 필요 없다.
 *
 * <p><b>왜 원천 CSV 를 그대로 넣어 두는가.</b> "24/29"·"29/29" 는 이슈의 결론이자 PR·문서가 적어 둔
 * 수치인데, 원천이 코스를 늘리거나 시종점 표기를 바꾸면 조용히 달라진다. 합성 데이터로는
 * 그 변화가 잡히지 않는다. 이 파일이 갱신될 때 이 테스트가 같이 깨져야 문서의 수치도 함께
 * 손보게 된다. {@code backend/data/olle_course.csv} 는 git 에 없는 우회용 파일이라 여기에
 * 사본을 둔다 — 공공데이터포털 "제주특별자치도_올레코스현황" 20250428 판과 20260731 판 원문이다
 * (20260731 판은 포털 원본을 UTF-8 로 바꾼 것. 3코스 A 코스명의 {@code ?} 는 원문 그대로다).
 */
class OlleCourseEndpointCoverageTest {

    private static final String CSV_RESOURCE = "/walkcourseimport/olle-course-20250428.csv";
    private static final String CSV_RESOURCE_20260731 = "/walkcourseimport/olle-course-20260731.csv";

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

    /**
     * 2026-07-31 판에서 순수 체이닝이 닿지 않는 여섯. 둘은 표기 차이({@code 화순제주올레안내소}(9)·
     * {@code 모슬포항하모체육공원}(10))라 별칭이, 넷은 그곳에서 출발하는 코스가 없어({@code 하동포구}(10-1)·
     * {@code 오설록녹차밭}(14-1)·{@code 종달바당}(21)·{@code 추자면사무소}(18-2)) 수기 종점이 채운다.
     */
    private static final List<String> COURSES_WITHOUT_CHAINED_END_20260731 = List.of("9", "10", "10-1", "14-1", "21", "18-2");

    /**
     * 코스별 시작점 좌표 {lat, lng}. <b>출처: dev walk_course 2026-09-28</b> — 2026-07-31 판 재적재 뒤의 시작점 좌표다.
     *
     * <p>가짜 좌표가 아닌 이유 — 수기 종점은 "시작점에서 코스 길이 안" 일 때만 채택되므로, 실좌표로 재야
     * 29/29 가 프로덕션에서도 나온다는 말이 된다.
     */
    private static final Map<String, double[]> DEV_START_POINTS_20260928 = Map.ofEntries(
        Map.entry("1", new double[] {33.4795908312d, 126.8954874884d}),
        Map.entry("1-1", new double[] {33.4928045323d, 126.9515413903d}),
        Map.entry("2", new double[] {33.4515223271d, 126.9233577769d}),
        Map.entry("3-A", new double[] {33.4052273903d, 126.9039134307d}),
        Map.entry("3-B", new double[] {33.4032303822d, 126.9028135788d}),
        Map.entry("4", new double[] {33.3250926392d, 126.8430117975d}),
        Map.entry("5", new double[] {33.2781058392d, 126.7197556431d}),
        Map.entry("6", new double[] {33.2522378511d, 126.6233901641d}),
        Map.entry("7", new double[] {33.247405491d, 126.558657419d}),
        Map.entry("7-1", new double[] {33.2489931359d, 126.5082204482d}),
        Map.entry("8", new double[] {33.2436001154d, 126.4585806466d}),
        Map.entry("9", new double[] {33.2370021213d, 126.3614842524d}),
        Map.entry("10", new double[] {33.2396847184d, 126.3346005778d}),
        Map.entry("10-1", new double[] {33.1742190951d, 126.2707885175d}),
        Map.entry("11", new double[] {33.2185711171d, 126.2527283438d}),
        Map.entry("12", new double[] {33.2746735552d, 126.2368116613d}),
        Map.entry("13", new double[] {33.3238222818d, 126.1660504817d}),
        Map.entry("14", new double[] {33.3336912174d, 126.2559673514d}),
        Map.entry("14-1", new double[] {33.3336912174d, 126.2559673514d}),
        Map.entry("15-A", new double[] {33.4190719416d, 126.2625564235d}),
        Map.entry("15-B", new double[] {33.4192876866d, 126.2625254768d}),
        Map.entry("16", new double[] {33.4669000009d, 126.3378979411d}),
        Map.entry("17", new double[] {33.459554279d, 126.4334141393d}),
        Map.entry("18", new double[] {33.5158749597d, 126.5303912747d}),
        Map.entry("18-1", new double[] {33.963531298d, 126.2960784477d}),
        Map.entry("18-2", new double[] {33.944600691683846d, 126.32903711792602d}),
        Map.entry("19", new double[] {33.5402952035d, 126.6399827169d}),
        Map.entry("20", new double[] {33.557138789d, 126.7452021271d}),
        Map.entry("21", new double[] {33.5235962997d, 126.8633977782d}));

    @TempDir
    Path tempDir;

    @Test
    @DisplayName("2025-04-28 판 - 29개 중 24개가 인접 코스에서 종점 좌표를 받는다 - 못 받는 다섯은 노선 구조상 정상이다")
    void twentyFourOfTwentyNineCoursesGetAnEndCoordinate() throws IOException {
        List<ImportedWalkCourse> resolved = OlleCourseEndpointResolver.resolveEndCoordinates(withFakeStartPoints(), OlleCourseEndpointOverrides.none());

        assertThat(resolved).hasSize(29);
        assertThat(resolved.stream().filter(course -> course.endLat() != null)).hasSize(24);
        assertThat(resolved.stream().filter(course -> course.endLat() == null))
            .extracting(ImportedWalkCourse::courseKey)
            .containsExactlyInAnyOrderElementsOf(COURSES_WITHOUT_END_COORDINATE);
    }

    @Test
    @DisplayName("공백만 다른 두 쌍이 실제 원천에서 이어진다 - 접지 않으면 4·20코스 시작점이 고아가 된다")
    void whitespaceVariantsChainInTheRealSource() throws IOException {
        List<ImportedWalkCourse> resolved = OlleCourseEndpointResolver.resolveEndCoordinates(withFakeStartPoints(), OlleCourseEndpointOverrides.none());

        // 3코스 종점 "제주민속촌주차장입구" ← 4코스 시작 "제주민속촌주차장 입구"
        assertThat(endCoordinateOf(resolved, "3-A")).isEqualTo(startCoordinateOf(resolved, "4"));
        assertThat(endCoordinateOf(resolved, "3-B")).isEqualTo(startCoordinateOf(resolved, "4"));
        // 19코스 종점 "김녕 서포구" ← 20코스 시작 "김녕서포구"
        assertThat(endCoordinateOf(resolved, "19")).isEqualTo(startCoordinateOf(resolved, "20"));
    }

    @Test
    @DisplayName("우도 1-1 은 순환이라 종점이 자기 시작점이고, 추자 18-1·18-2 는 서로의 시종점을 준다")
    void circularAndReversedCoursesResolve() throws IOException {
        List<ImportedWalkCourse> resolved = OlleCourseEndpointResolver.resolveEndCoordinates(withFakeStartPoints(), OlleCourseEndpointOverrides.none());

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

    @Test
    @DisplayName("2026-07-31 판 - 확인된 별칭·수기 종점으로 29개 전부 종점 좌표를 받는다")
    void allTwentyNineCoursesGetAnEndCoordinateIn20260731() throws IOException {
        List<ImportedWalkCourse> resolved =
            OlleCourseEndpointResolver.resolveEndCoordinates(withDevStartPoints(), OlleCourseEndpointOverrides.defaults());

        assertThat(resolved).hasSize(29);
        assertThat(resolved).allSatisfy(course -> {
            assertThat(course.endLat()).as("%s(%s) endLat", course.courseKey(), course.endPointName()).isNotNull();
            assertThat(course.endLng()).as("%s(%s) endLng", course.courseKey(), course.endPointName()).isNotNull();
        });
    }

    @Test
    @DisplayName("2026-07-31 판 - 순수 체이닝만으로는 23개다 - 빠지는 여섯이 별칭·수기가 채우는 자리다")
    void twentyThreeOfTwentyNineWithoutOverridesIn20260731() throws IOException {
        List<ImportedWalkCourse> resolved =
            OlleCourseEndpointResolver.resolveEndCoordinates(withDevStartPoints(), OlleCourseEndpointOverrides.none());

        assertThat(resolved.stream().filter(course -> course.endLat() != null)).hasSize(23);
        assertThat(resolved.stream().filter(course -> course.endLat() == null))
            .extracting(ImportedWalkCourse::courseKey)
            .containsExactlyInAnyOrderElementsOf(COURSES_WITHOUT_CHAINED_END_20260731);
    }

    @Test
    @DisplayName("2026-07-31 판 - 별칭 두 쌍은 다음 코스 시작점을, 수기 네 곳은 확인한 좌표를 준다")
    void overridesFillTheSixGapsIn20260731() throws IOException {
        List<ImportedWalkCourse> resolved =
            OlleCourseEndpointResolver.resolveEndCoordinates(withDevStartPoints(), OlleCourseEndpointOverrides.defaults());

        // 9코스 종점 화순제주올레안내소 → 10코스 시작 화순금모래해변
        assertThat(endCoordinateOf(resolved, "9")).isEqualTo(startCoordinateOf(resolved, "10"));
        // 10코스 종점 모슬포항하모체육공원 → 11코스 시작 하모체육공원
        assertThat(endCoordinateOf(resolved, "10")).isEqualTo(startCoordinateOf(resolved, "11"));
        assertThat(endCoordinateOf(resolved, "10-1")).isEqualTo("33.165826,126.273188");
        assertThat(endCoordinateOf(resolved, "14-1")).isEqualTo("33.3059240323,126.2894922148");
        assertThat(endCoordinateOf(resolved, "21")).isEqualTo("33.4963286013,126.9097146979");
        assertThat(endCoordinateOf(resolved, "18-2")).isEqualTo("33.963665,126.296061");
    }

    @Test
    @DisplayName("2026-07-31 판 - 29행 전부 시종점을 가른다 - 18-2 의 경유지 나열(·)도 첫·끝 지점으로 읽는다")
    void everyRowSplitsIntoTwoPointNamesIn20260731() throws IOException {
        List<ImportedWalkCourse> courses = loadCourses(CSV_RESOURCE_20260731);

        assertThat(courses).extracting(ImportedWalkCourse::courseKey)
            .containsExactlyInAnyOrderElementsOf(DEV_START_POINTS_20260928.keySet());
        assertThat(courses).allSatisfy(course -> {
            assertThat(course.startPointName()).isNotBlank();
            assertThat(course.endPointName()).isNotBlank();
        });
        ImportedWalkCourse chuja = byKey(courses, "18-2");
        assertThat(chuja.startPointName()).isEqualTo("신양항");
        assertThat(chuja.endPointName()).isEqualTo("추자면사무소");
    }

    /** 2026-07-31 판 원천 CSV 에 dev 실측 시작점 좌표를 붙인다. 좌표가 빠진 코스가 있으면 fixture 가 원천과 어긋난 것이다. */
    private List<ImportedWalkCourse> withDevStartPoints() throws IOException {
        return loadCourses(CSV_RESOURCE_20260731).stream()
            .map(course -> {
                double[] start = Objects.requireNonNull(DEV_START_POINTS_20260928.get(course.courseKey()), course.courseKey());
                return course.withCoordinate(start[0], start[1], null, null);
            })
            .toList();
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
        return loadCourses(CSV_RESOURCE);
    }

    private List<ImportedWalkCourse> loadCourses(String resource) throws IOException {
        Path csv = tempDir.resolve(resource.substring(resource.lastIndexOf('/') + 1));
        try (InputStream source = Objects.requireNonNull(getClass().getResourceAsStream(resource), resource)) {
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
