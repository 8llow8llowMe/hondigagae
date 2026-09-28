package com.hondigagae.domainlayer.walkcourseimport.domain.model;

import com.hondigagae.common.geo.GeoDistance;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import lombok.extern.slf4j.Slf4j;

/**
 * 종점 좌표를 <b>인접 코스의 시작점 좌표</b>에서 끌어온다 (#816, #960).
 *
 * <p>올레는 한 코스의 종점이 다음 코스의 시작점이다 — 1코스 종점 {@code 광치기해변} 은 곧
 * 2코스 시작점이다. 시작점 좌표는 TourAPI 매칭으로 이미 들어와 있으므로, <b>지점명으로 되찾기만
 * 하면 종점 좌표를 새 원천 없이 얻는다.</b>
 *
 * <p><b>판본마다 지점명이 바뀐다.</b> 순수 체이닝으로 닿는 수가 판본마다 다르다.
 * <ul>
 *   <li>2025-04-28 판 — 29건 중 24건. 빠진 다섯은 {@code 월평아왜낭목쉼터} · {@code 화순금모래해수욕장} ·
 *       {@code 종달바당} · {@code 가파치안센터} · {@code 오설록녹차밭}</li>
 *   <li>2026-07-31 판 — 29건 중 23건. 빠진 여섯은 {@code 화순제주올레안내소}(9) ·
 *       {@code 모슬포항하모체육공원}(10) · {@code 하동포구}(10-1) · {@code 오설록녹차밭}(14-1) ·
 *       {@code 종달바당}(21) · {@code 추자면사무소}(18-2)</li>
 * </ul>
 * 2026-07-31 판의 여섯은 {@link OlleCourseEndpointOverrides} 의 <b>사람이 확인한</b> 별칭 두 쌍과 수기 종점
 * 네 곳으로 채워 29/29 가 된다. 그 값은 지점명이 정확히 같을 때만 쓰이므로, 다음 판본이 이름을 바꾸면
 * 자동으로 빠지고 빈칸으로 돌아간다 — 틀린 곳에 남지 않는다.
 *
 * <p><b>왜 지오코딩하지 않는가.</b> 올레 지점명은 주소가 아니라 지역 지명이라 주소 지오코더가 못 풀거나
 * 엉뚱한 곳을 준다(VWorld 에 {@code 하동포구} 를 물으면 경남 하동군이 나온다). 지도에 틀린 점을 찍는
 * 것은 빈 칸보다 나쁘다. 적재 중에는 지오코딩하지 않고, 확인은 사람이 해서 목록에 적는다.
 *
 * <p><b>해석 순서.</b> (a) 정확한 지점명 체이닝 → (b) 별칭으로 체이닝 → (c) 수기 종점. (b)(c) 로 얻은 값은
 * 코스 시작점과의 직선거리가 코스 길이({@code distanceKm})를 넘으면 버린다 — 종점이 걸어서 닿는 거리보다
 * 멀리 있을 수는 없다. (a) 에는 이 검사를 걸지 않는다(#816 동작 보존, 같은 지점명 일치 검사가 따로 있다).
 *
 * <p><b>왜 경로 좌표열이 아니라 두 점인가.</b> 경로 좌표열을 주는 공개 원천이 없다 —
 * {@code backend/docs/data-api-analysis.md} §9 가 네 곳을 전수 조사해 남겨 뒀다 (#736).
 */
@Slf4j
public final class OlleCourseEndpointResolver {

    /**
     * 같은 지점명을 쓰는 코스들의 시작점 좌표가 <b>이만큼 안에 있어야</b> 같은 들머리로 본다.
     *
     * <p>이 검사가 이 클래스의 전제를 지킨다 — 체이닝은 "TourAPI 좌표 = 코스 시작점"을 믿는데,
     * 그것이 코스 어딘가의 대표점이라면 3-A·3-B 처럼 <b>같은 곳에서 출발해 다른 길로 가는</b>
     * 코스들의 좌표가 벌어진다. 벌어지면 그 지점명은 믿지 않고 색인에서 빼므로, 전제가 틀려도
     * 틀린 좌표가 나가지는 않는다.
     *
     * <p>500m 로 둔 이유: 같은 들머리라도 TourAPI 항목마다 마커를 조금씩 다르게 찍는다. 더
     * 좁히면 멀쩡한 쌍이 걸려 종점 좌표를 잃고, 더 넓히면 이웃 지점까지 같은 곳으로 본다.
     */
    private static final double SAME_POINT_TOLERANCE_METERS = 500d;

    private static final double METERS_PER_KM = 1000d;

    private OlleCourseEndpointResolver() {
    }

    /**
     * 시작점 좌표 색인으로 각 코스의 종점 좌표를 채운 목록. 입력 순서를 그대로 지킨다.
     *
     * <p>순환 코스(1-1 우도)는 시작과 종점의 지점명이 같아 <b>자기 시작점</b>이 종점이 된다.
     * 두 점이 같아지지만 그것은 사실이다 — <b>두 점 사이 거리가 0 이라고 코스 길이가 0 인 것이
     * 아니다.</b> 거리는 {@code distanceKm}(2025-04-28 판 11.3km, 2026-07-31 판 11.5km)가 따로 말한다.
     */
    public static List<ImportedWalkCourse> resolveEndCoordinates(List<ImportedWalkCourse> courses) {
        return resolveEndCoordinates(courses, OlleCourseEndpointOverrides.defaults());
    }

    /**
     * {@link #resolveEndCoordinates(List)} 와 같되, 체이닝이 닿지 않는 종점에 덧댈 값을 고른다.
     * {@link OlleCourseEndpointOverrides#none()} 을 넘기면 순수 체이닝만 한다.
     */
    public static List<ImportedWalkCourse> resolveEndCoordinates(
        List<ImportedWalkCourse> courses, OlleCourseEndpointOverrides overrides
    ) {
        Objects.requireNonNull(overrides, "overrides");
        Map<String, ImportedWalkCourse> startIndex = buildStartPointIndex(courses);
        return courses.stream()
            .map(course -> withEndCoordinate(startIndex, overrides, course))
            .toList();
    }

    private static ImportedWalkCourse withEndCoordinate(
        Map<String, ImportedWalkCourse> startIndex, OlleCourseEndpointOverrides overrides, ImportedWalkCourse course
    ) {
        String endKey = OlleCourseParser.pointNameKey(course.endPointName());
        if (endKey == null) {
            return course;
        }

        // (a) 정확한 지점명 체이닝. #816 동작 그대로 - 타당성 검사를 걸지 않는다
        ImportedWalkCourse provider = startIndex.get(endKey);
        if (provider != null) {
            return filled(course, EndpointSource.CHAIN, provider.lat(), provider.lng());
        }

        // (b) 사람이 확인한 별칭으로 체이닝
        String aliasKey = overrides.aliasOf(endKey);
        ImportedWalkCourse aliasProvider = aliasKey == null ? null : startIndex.get(aliasKey);
        if (aliasProvider != null && isPlausible(course, EndpointSource.ALIAS, aliasProvider.lat(), aliasProvider.lng())) {
            return filled(course, EndpointSource.ALIAS, aliasProvider.lat(), aliasProvider.lng());
        }

        // (c) 사람이 확인한 수기 종점
        OlleCourseEndpointOverrides.ManualEndPoint manual = overrides.manualEndPointOf(endKey);
        if (manual != null && isPlausible(course, EndpointSource.MANUAL, manual.lat(), manual.lng())) {
            return filled(course, EndpointSource.MANUAL, manual.lat(), manual.lng());
        }
        return course;
    }

    private static ImportedWalkCourse filled(ImportedWalkCourse course, EndpointSource source, double endLat, double endLng) {
        log.debug("olle end coordinate resolved. course={}, endPoint={}, source={}", course.courseKey(), course.endPointName(), source);
        return course.withEndCoordinate(endLat, endLng);
    }

    /**
     * 덧댄 종점이 이 코스의 종점일 수 있는가. 코스 시작점에서의 직선거리가 코스 길이를 넘으면 버린다 —
     * 걸어서 {@code distanceKm} 인 길의 끝이 직선으로 그보다 멀 수는 없다. 별칭이 다른 곳을 가리키거나
     * 수기 좌표에 오타가 난 날 그 점이 지도에 나가지 않게 하는 마지막 그물이다.
     *
     * <p>시작점 좌표나 코스 길이가 없으면 <b>검사할 수 없으므로 믿지 않는다.</b>
     */
    private static boolean isPlausible(ImportedWalkCourse course, EndpointSource source, double endLat, double endLng) {
        if (course.lat() == null || course.lng() == null || course.distanceKm() == null) {
            log.debug("olle end coordinate skipped, cannot check plausibility. course={}, source={}", course.courseKey(), source);
            return false;
        }
        double gap = GeoDistance.meters(course.lat(), course.lng(), endLat, endLng);
        double limit = course.distanceKm().doubleValue() * METERS_PER_KM;
        if (gap > limit) {
            log.warn("olle end coordinate rejected, farther than course length. course={}, source={}, gapMeters={}, limitMeters={}",
                course.courseKey(), source, Math.round(gap), Math.round(limit));
            return false;
        }
        return true;
    }

    /** 종점 좌표를 어디서 얻었는지. 로그에만 쓴다. */
    private enum EndpointSource {
        /** 같은 지점명에서 출발하는 코스의 시작점 */
        CHAIN,
        /** 사람이 확인한 별칭 지점명에서 출발하는 코스의 시작점 */
        ALIAS,
        /** 사람이 확인한 수기 좌표 */
        MANUAL
    }

    /**
     * 지점명 → 그 지점에서 출발하는 코스. 좌표가 없는 코스는 넣지 않는다 — 색인에 들어가도
     * 줄 것이 없고, 들어가면 좌표 있는 같은 이름의 코스를 가릴 수 있다.
     *
     * <p>같은 지점명을 여러 코스가 쓰면 {@code courseOrder} 가 앞선 코스를 택해 <b>실행마다 같은
     * 값</b>이 나오게 한다. 다만 그 전에 좌표들이 서로 가까운지 본다.
     */
    private static Map<String, ImportedWalkCourse> buildStartPointIndex(List<ImportedWalkCourse> courses) {
        Map<String, List<ImportedWalkCourse>> byPointName = new LinkedHashMap<>();
        for (ImportedWalkCourse course : courses) {
            String key = OlleCourseParser.pointNameKey(course.startPointName());
            if (key == null || course.lat() == null || course.lng() == null) {
                continue;
            }
            byPointName.computeIfAbsent(key, ignored -> new ArrayList<>()).add(course);
        }

        Map<String, ImportedWalkCourse> index = new HashMap<>();
        for (Map.Entry<String, List<ImportedWalkCourse>> entry : byPointName.entrySet()) {
            List<ImportedWalkCourse> sharing = entry.getValue();
            if (!agreeOnSamePoint(entry.getKey(), sharing)) {
                continue;
            }
            index.put(entry.getKey(), sharing.stream()
                .min(Comparator.comparingInt(ImportedWalkCourse::courseOrder))
                .orElseThrow());
        }
        return index;
    }

    /**
     * 같은 지점명을 쓰는 코스들의 시작점이 실제로 한 곳인지. 어긋나면 <b>그 지점명 전체를
     * 버린다</b> — 둘 중 어느 쪽이 맞는지 알 방법이 없고, 반반의 확률로 고르느니 종점 좌표를
     * 비우는 편이 낫다. 어느 쌍이 얼마나 벌어졌는지는 로그로 남겨 다음 실행 때 원인을 볼 수 있게 한다.
     */
    private static boolean agreeOnSamePoint(String pointNameKey, List<ImportedWalkCourse> sharing) {
        for (int i = 0; i < sharing.size(); i++) {
            for (int j = i + 1; j < sharing.size(); j++) {
                ImportedWalkCourse left = sharing.get(i);
                ImportedWalkCourse right = sharing.get(j);
                double gap = GeoDistance.meters(left.lat(), left.lng(), right.lat(), right.lng());
                if (gap > SAME_POINT_TOLERANCE_METERS) {
                    log.warn("olle start points disagree. point={}, courses={} vs {}, gapMeters={}",
                        pointNameKey, left.courseKey(), right.courseKey(), Math.round(gap));
                    return false;
                }
            }
        }
        return true;
    }
}
