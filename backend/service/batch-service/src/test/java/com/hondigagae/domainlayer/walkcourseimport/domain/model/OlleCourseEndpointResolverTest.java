package com.hondigagae.domainlayer.walkcourseimport.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 종점 좌표를 인접 코스의 시작점에서 끌어오는 규칙 (#816).
 *
 * <p>고정하는 것은 다섯이다.
 * <ul>
 *   <li><b>이어지는가</b> — 1코스 종점 {@code 광치기해변} 은 2코스 시작점이다</li>
 *   <li><b>표기가 갈려도 이어지는가</b> — {@code 제주민속촌주차장입구} 와
 *       {@code 제주민속촌주차장 입구} 는 공백만 다른 같은 곳이다. 접지 않으면 같은 지점이
 *       지도에 두 번 찍힌다</li>
 *   <li><b>못 이으면 비우는가</b> — 그 지점에서 출발하는 코스가 없으면 null 이다. 지어내지 않는다</li>
 *   <li><b>순환 코스</b> — 1-1(우도)은 시작과 종점이 같은 지점이라 두 점이 겹친다. 그것이 사실이다</li>
 *   <li><b>전제가 깨지면 멈추는가</b> — 같은 지점명인데 좌표가 멀면 그 지점명을 통째로 버린다.
 *       "TourAPI 좌표 = 코스 시작점" 이 틀린 날 틀린 좌표가 나가지 않게 하는 안전장치다</li>
 * </ul>
 * 위 다섯은 {@link OlleCourseEndpointOverrides#none()} 으로 <b>순수 체이닝만</b> 본다 ({@code chainOnly}).
 *
 * <p>사람이 확인한 별칭·수기 종점(#960)에 대해서는 이것을 고정한다.
 * <ul>
 *   <li><b>별칭으로 이어지는가</b>, <b>수기 좌표가 들어가는가</b> — 체이닝이 닿지 않을 때만</li>
 *   <li><b>타당성 검사</b> — 시작점에서 코스 길이보다 멀면 버린다. 시작점 좌표나 코스 길이가 없으면
 *       검사할 수 없으므로 쓰지 않는다</li>
 *   <li><b>이름이 정확히 같을 때만</b> — 한 글자라도 다르면 쓰지 않는다. 판본이 이름을 바꾸면 빠진다</li>
 * </ul>
 */
class OlleCourseEndpointResolverTest {

    @Test
    @DisplayName("한 코스의 종점은 다음 코스의 시작점 좌표를 받는다")
    void endPointComesFromTheNextCourseStart() {
        List<ImportedWalkCourse> resolved = chainOnly(List.of(
            course("1", 10, "시흥리정류장", "광치기해변", 33.4796d, 126.8955d),
            course("2", 20, "광치기해변", "온평포구", 33.4457d, 126.9223d)));

        ImportedWalkCourse first = byKey(resolved).get("1");
        assertThat(first.endLat()).isEqualTo(33.4457d);
        assertThat(first.endLng()).isEqualTo(126.9223d);
        // 시작점은 건드리지 않는다
        assertThat(first.lat()).isEqualTo(33.4796d);
    }

    @Test
    @DisplayName("공백만 다른 표기도 같은 지점으로 이어진다 - 안 접으면 같은 곳이 지도에 두 번 찍힌다")
    void whitespaceOnlyDifferenceStillMatches() {
        List<ImportedWalkCourse> resolved = chainOnly(List.of(
            // 3코스는 붙여 쓰고, 4코스는 띄어 쓴다 - 원천의 실제 표기 차이다
            course("3-A", 30, "온평포구", "제주민속촌주차장입구", 33.3862d, 126.9170d),
            course("4", 40, "제주민속촌주차장 입구", "남원포구", 33.3223d, 126.7982d)));

        assertThat(byKey(resolved).get("3-A").endLat()).isEqualTo(33.3223d);
    }

    @Test
    @DisplayName("그 지점에서 출발하는 코스가 없으면 종점 좌표는 null 이다 - 지어내지 않는다")
    void terminalEndPointStaysNull() {
        List<ImportedWalkCourse> resolved = chainOnly(List.of(
            // 21코스 종점 종달바당에서 출발하는 코스는 없다
            course("21", 210, "제주해녀박물관", "종달바당", 33.5433d, 126.8032d)));

        ImportedWalkCourse last = byKey(resolved).get("21");
        assertThat(last.endLat()).isNull();
        assertThat(last.endLng()).isNull();
        assertThat(last.endPointName()).isEqualTo("종달바당");
    }

    @Test
    @DisplayName("한쪽이 다른 쪽을 포함하는 이름은 접지 않는다 - 부분일치로 접으면 엉뚱한 지점이 엮인다")
    void partialNameOverlapIsNotMerged() {
        List<ImportedWalkCourse> resolved = chainOnly(List.of(
            course("7", 70, "제주올레여행자센터", "월평아왜낭목쉼터", 33.2470d, 126.5610d),
            course("8", 80, "월평아왜낭목", "대평포구", 33.2447d, 126.4470d)));

        // "월평아왜낭목쉼터" 와 "월평아왜낭목" 은 같은 들머리로 보이지만 같다고 단정하지 않는다
        assertThat(byKey(resolved).get("7").endLat()).isNull();
    }

    @Test
    @DisplayName("순환 코스는 자기 시작점이 종점이 된다 - 두 점이 겹쳐도 코스 길이가 0 인 것은 아니다")
    void circularCourseEndsWhereItStarts() {
        List<ImportedWalkCourse> resolved = chainOnly(List.of(
            course("1-1", 11, "천진항.하우목동항", "천진항.하우목동항", 33.5060d, 126.9520d)));

        ImportedWalkCourse circular = byKey(resolved).get("1-1");
        assertThat(circular.endLat()).isEqualTo(circular.lat());
        assertThat(circular.endLng()).isEqualTo(circular.lng());
        // 길이는 두 점 사이 거리가 아니라 원천 수치가 말한다
        assertThat(circular.distanceKm()).isEqualByComparingTo(new BigDecimal("11.3"));
    }

    @Test
    @DisplayName("시작점 좌표가 없는 코스는 색인에 들어가지 않는다 - 줄 것이 없으면서 자리만 차지한다")
    void courseWithoutStartCoordinateDoesNotFeedTheIndex() {
        List<ImportedWalkCourse> resolved = chainOnly(List.of(
            course("19", 190, "조천만세동산", "김녕 서포구", 33.5390d, 126.6370d),
            course("20", 200, "김녕서포구", "제주해녀박물관", null, null)));

        assertThat(byKey(resolved).get("19").endLat()).isNull();
    }

    @Test
    @DisplayName("같은 지점명인데 좌표가 멀면 그 지점명을 통째로 버린다 - 반반의 확률로 고르지 않는다")
    void disagreeingStartPointsAreDropped() {
        List<ImportedWalkCourse> resolved = chainOnly(List.of(
            course("2", 20, "광치기해변", "온평포구", 33.4457d, 126.9223d),
            // 3-A 와 3-B 는 같은 곳에서 출발하는데 좌표가 1km 넘게 벌어졌다
            course("3-A", 30, "온평포구", "제주민속촌주차장입구", 33.3862d, 126.9170d),
            course("3-B", 31, "온평포구", "제주민속촌주차장입구", 33.4162d, 126.9170d)));

        // 2코스 종점은 온평포구인데, 온평포구가 어디인지 두 코스가 다르게 말하므로 비운다
        assertThat(byKey(resolved).get("2").endLat()).isNull();
    }

    @Test
    @DisplayName("좌표가 서로 가까우면 courseOrder 가 앞선 코스를 택한다 - 실행마다 같은 값이 나와야 한다")
    void agreeingStartPointsPickTheLowestCourseOrder() {
        List<ImportedWalkCourse> resolved = chainOnly(List.of(
            course("2", 20, "광치기해변", "온평포구", 33.4457d, 126.9223d),
            // 같은 들머리를 TourAPI 가 100m 남짓 다르게 찍은 정도는 같은 곳으로 본다
            course("3-A", 30, "온평포구", "제주민속촌주차장입구", 33.3862d, 126.9170d),
            course("3-B", 31, "온평포구", "제주민속촌주차장입구", 33.3872d, 126.9170d)));

        assertThat(byKey(resolved).get("2").endLat()).isEqualTo(33.3862d);
    }

    @Test
    @DisplayName("시종점을 가르지 못한 코스는 이어 붙이지 않는다 - 원문만 남는다")
    void courseWithoutParsedPointNamesIsLeftAlone() {
        ImportedWalkCourse unparsed = course("9", 90, null, null, 33.2447d, 126.4470d);

        List<ImportedWalkCourse> resolved = chainOnly(List.of(unparsed));

        assertThat(resolved.get(0).endLat()).isNull();
        assertThat(resolved.get(0).lat()).isEqualTo(33.2447d);
    }

    @Test
    @DisplayName("체이닝이 닿지 않는 종점은 확인된 별칭으로 이어진다 - 10코스 모슬포항하모체육공원 = 11코스 하모체육공원")
    void aliasChainsWhenExactNameMisses() {
        List<ImportedWalkCourse> courses = List.of(
            course("10", 100, "화순금모래해변", "모슬포항하모체육공원", 33.2396847184d, 126.3346005778d, new BigDecimal("17.3")),
            course("11", 110, "하모체육공원", "제주자연생태문화체험골", 33.2185711171d, 126.2527283438d, new BigDecimal("17.8")));

        ImportedWalkCourse tenth = byKey(withDefaults(courses)).get("10");
        assertThat(tenth.endLat()).isEqualTo(33.2185711171d);
        assertThat(tenth.endLng()).isEqualTo(126.2527283438d);
        // 순수 체이닝으로는 닿지 않는다 - 별칭이 채운 것이다
        assertThat(byKey(chainOnly(courses)).get("10").endLat()).isNull();
    }

    @Test
    @DisplayName("정확한 체이닝이 있으면 별칭·수기보다 먼저 쓴다")
    void exactChainWinsOverOverrides() {
        List<ImportedWalkCourse> resolved = withDefaults(List.of(
            course("20", 200, "김녕서포구", "종달바당", 33.557138789d, 126.7452021271d),
            course("21", 210, "종달바당", "시흥초등학교", 33.5000d, 126.9000d)));

        // 종달바당에서 출발하는 코스가 있으면 수기 좌표(33.4888...)가 아니라 그 시작점을 받는다
        assertThat(byKey(resolved).get("20").endLat()).isEqualTo(33.5000d);
    }

    @Test
    @DisplayName("출발하는 코스가 없는 종점은 확인된 수기 좌표를 받는다 - 21코스 종달바당")
    void manualEndPointFillsTerminalCourse() {
        List<ImportedWalkCourse> resolved = withDefaults(List.of(
            course("21", 210, "제주해녀박물관", "종달바당", 33.5235962997d, 126.8633977782d, new BigDecimal("11.1"))));

        ImportedWalkCourse last = byKey(resolved).get("21");
        assertThat(last.endLat()).isEqualTo(33.488836d);
        assertThat(last.endLng()).isEqualTo(126.905312d);
    }

    @Test
    @DisplayName("수기 좌표가 시작점에서 코스 길이보다 멀면 버린다 - 걸어서 닿는 거리보다 먼 종점은 없다")
    void manualEndPointFartherThanCourseLengthIsRejected() {
        List<ImportedWalkCourse> resolved = withDefaults(List.of(
            // 시작점에서 종달바당 수기 좌표까지 직선 약 5.5km 인데 코스 길이를 1km 로 줬다
            course("21", 210, "제주해녀박물관", "종달바당", 33.5235962997d, 126.8633977782d, new BigDecimal("1.0"))));

        assertThat(byKey(resolved).get("21").endLat()).isNull();
    }

    @Test
    @DisplayName("별칭 대상이 시작점에서 코스 길이보다 멀어도 버린다")
    void aliasFartherThanCourseLengthIsRejected() {
        List<ImportedWalkCourse> resolved = withDefaults(List.of(
            // 10코스 시작점에서 11코스 시작점까지 직선 약 8km 인데 코스 길이를 2km 로 줬다
            course("10", 100, "화순금모래해변", "모슬포항하모체육공원", 33.2396847184d, 126.3346005778d, new BigDecimal("2.0")),
            course("11", 110, "하모체육공원", "제주자연생태문화체험골", 33.2185711171d, 126.2527283438d)));

        assertThat(byKey(resolved).get("10").endLat()).isNull();
    }

    @Test
    @DisplayName("시작점 좌표가 없으면 수기 좌표를 쓰지 않는다 - 검사할 수 없으면 믿지 않는다")
    void manualEndPointNeedsStartCoordinateToBeChecked() {
        List<ImportedWalkCourse> resolved = withDefaults(List.of(
            course("21", 210, "제주해녀박물관", "종달바당", null, null, new BigDecimal("11.1"))));

        assertThat(byKey(resolved).get("21").endLat()).isNull();
    }

    @Test
    @DisplayName("코스 길이가 없어도 수기 좌표를 쓰지 않는다 - 검사할 수 없으면 믿지 않는다")
    void manualEndPointNeedsDistanceToBeChecked() {
        List<ImportedWalkCourse> resolved = withDefaults(List.of(
            course("21", 210, "제주해녀박물관", "종달바당", 33.5235962997d, 126.8633977782d, null)));

        assertThat(byKey(resolved).get("21").endLat()).isNull();
    }

    @Test
    @DisplayName("지점명이 한 글자라도 다르면 별칭·수기를 쓰지 않는다 - 판본이 이름을 바꾸면 자동으로 빠진다")
    void overridesApplyOnlyToExactNames() {
        List<ImportedWalkCourse> resolved = withDefaults(List.of(
            course("21", 210, "제주해녀박물관", "종달바다", 33.5235962997d, 126.8633977782d, new BigDecimal("11.1")),
            course("10", 100, "화순금모래해변", "모슬포항하모체육공원입구", 33.2396847184d, 126.3346005778d, new BigDecimal("17.3")),
            course("11", 110, "하모체육공원", "제주자연생태문화체험골", 33.2185711171d, 126.2527283438d)));

        assertThat(byKey(resolved).get("21").endLat()).isNull();
        assertThat(byKey(resolved).get("10").endLat()).isNull();
    }

    @Test
    @DisplayName("공백만 다른 표기에는 별칭·수기가 그대로 쓰인다 - 매칭 키와 같은 규칙이다")
    void overridesFoldWhitespaceLikeTheMatchingKey() {
        List<ImportedWalkCourse> resolved = withDefaults(List.of(
            course("21", 210, "제주해녀박물관", "종달 바당", 33.5235962997d, 126.8633977782d, new BigDecimal("11.1"))));

        assertThat(byKey(resolved).get("21").endLat()).isEqualTo(33.488836d);
    }

    @Test
    @DisplayName("none() 이면 별칭·수기를 전혀 쓰지 않는다 - 순수 체이닝 결과와 같다")
    void noneKeepsPureChaining() {
        List<ImportedWalkCourse> resolved = chainOnly(List.of(
            course("10", 100, "화순금모래해변", "모슬포항하모체육공원", 33.2396847184d, 126.3346005778d, new BigDecimal("17.3")),
            course("11", 110, "하모체육공원", "제주자연생태문화체험골", 33.2185711171d, 126.2527283438d),
            course("21", 210, "제주해녀박물관", "종달바당", 33.5235962997d, 126.8633977782d, new BigDecimal("11.1"))));

        assertThat(resolved).allSatisfy(course -> assertThat(course.endLat()).isNull());
    }

    @Test
    @DisplayName("인자 하나짜리는 defaults() 를 쓴다 - 프로덕션 기본값이다")
    void singleArgumentUsesDefaults() {
        List<ImportedWalkCourse> courses = List.of(
            course("21", 210, "제주해녀박물관", "종달바당", 33.5235962997d, 126.8633977782d, new BigDecimal("11.1")));

        assertThat(OlleCourseEndpointResolver.resolveEndCoordinates(courses)).isEqualTo(withDefaults(courses));
        assertThat(OlleCourseEndpointResolver.resolveEndCoordinates(courses).get(0).endLat()).isNotNull();
    }

    private static List<ImportedWalkCourse> chainOnly(List<ImportedWalkCourse> courses) {
        return OlleCourseEndpointResolver.resolveEndCoordinates(courses, OlleCourseEndpointOverrides.none());
    }

    private static List<ImportedWalkCourse> withDefaults(List<ImportedWalkCourse> courses) {
        return OlleCourseEndpointResolver.resolveEndCoordinates(courses, OlleCourseEndpointOverrides.defaults());
    }

    private static Map<String, ImportedWalkCourse> byKey(List<ImportedWalkCourse> courses) {
        return courses.stream().collect(Collectors.toMap(ImportedWalkCourse::courseKey, Function.identity()));
    }

    private static ImportedWalkCourse course(
        String courseKey, int courseOrder, String startPointName, String endPointName, Double lat, Double lng
    ) {
        return course(courseKey, courseOrder, startPointName, endPointName, lat, lng, new BigDecimal("11.3"));
    }

    private static ImportedWalkCourse course(
        String courseKey, int courseOrder, String startPointName, String endPointName, Double lat, Double lng, BigDecimal distanceKm
    ) {
        return ImportedWalkCourse.builder()
            .id(courseKey.hashCode())
            .courseKey(courseKey)
            .courseNo(courseKey)
            .courseOrder(courseOrder)
            .name("코스" + courseKey)
            .distanceKm(distanceKm)
            .durationText("4~5시간")
            .durationMaxMinutes(300)
            .startEndPoint(startPointName + "-" + endPointName)
            .startPointName(startPointName)
            .endPointName(endPointName)
            .baseDate("2025-04-28")
            .lat(lat)
            .lng(lng)
            .build();
    }
}
