package com.hondigagae.domainlayer.walkcourseimport.domain.model;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.function.UnaryOperator;

/**
 * 체이닝으로 닿지 않는 올레 종점을 채우는, <b>사람이 확인한 값만</b> 담은 목록 (#960). 불변이다.
 *
 * <p>{@link OlleCourseEndpointResolver} 는 "코스 N 의 종점 = 같은 이름에서 출발하는 코스의 시작점" 으로
 * 종점 좌표를 채운다. 이름이 정확히 같지 않거나 그 지점에서 출발하는 코스가 없으면 닿지 않는데,
 * 그 빈칸을 <b>규칙이 아니라 목록</b>으로 메운다. 두 가지다.
 *
 * <ul>
 *   <li><b>별칭</b> — 종점 지점명 key → 체이닝에 쓸 시작 지점명 key. 원천이 같은 곳을 두 이름으로
 *       부르는 짝이다 (2026-07-31 판 10코스 종점 {@code 모슬포항하모체육공원} = 11코스 시작
 *       {@code 하모체육공원}).</li>
 *   <li><b>수기 종점</b> — 종점 지점명 key → 좌표와 근거. 그 지점에서 출발하는 코스가 아예 없는
 *       종점이다 (10-1 가파도, 14-1 지선, 21 마지막 코스, 18-2 추자도).</li>
 * </ul>
 *
 * <p><b>왜 부분일치 규칙이 아니라 짝을 하나씩 적는가.</b> "한쪽이 다른 쪽을 포함하면 같은 곳" 같은
 * 규칙은 {@code ○○포구}·{@code ○○항} 류 지명을 줄줄이 엮는다. 틀린 점은 빈칸보다 나쁘므로, 사람이
 * 지도에서 같은 곳임을 확인한 짝만 적고 나머지는 비워 둔다 ({@code OlleCourseParser.pointNameKey}).
 *
 * <p><b>왜 적재 중에 지오코딩하지 않는가.</b> 올레 종점명은 주소가 아니라 지역 지명이라 지오코더가
 * 엉뚱한 곳을 준다. 실례: VWorld 검색에 {@code 하동포구} 를 물으면 <b>경상남도 하동군</b>이 나온다.
 * 가파도의 하동포구는 "가파포구"(서귀포시 대정읍 가파리 561-1)로 물어야 나온다 — 이 판단은 사람이 한다.
 *
 * <p><b>이름이 정확히 같을 때만 쓰인다.</b> 원천 판본마다 지점명이 바뀐다 — 2025-04-28 판
 * {@code 화순금모래해수욕장}·{@code 가파치안센터} 가 2026-07-31 판에서는 {@code 화순제주올레안내소}·
 * {@code 하동포구} 가 됐다. key 는 공백만 접은 {@code pointNameKey} 로 비교하므로, 원천이 이름을 바꾸면
 * 이 목록의 값은 <b>자동으로 빠지고</b> 종점이 빈칸으로 돌아간다. 틀린 곳에 남는 일은 없다.
 * 그렇게 빠진 종점은 적재 로그 {@code olle courses without end coordinates} 에 이름과 함께 나온다.
 *
 * <p>여기 값도 믿기만 하지는 않는다 — {@link OlleCourseEndpointResolver} 가 코스 시작점과의 직선거리가
 * 코스 길이를 넘는지 본다.
 *
 * @param aliases         종점 지점명 key → 체이닝에 쓸 시작 지점명 key
 * @param manualEndPoints 종점 지점명 key → 확인된 종점 좌표
 */
public record OlleCourseEndpointOverrides(
    Map<String, String> aliases,
    Map<String, ManualEndPoint> manualEndPoints
) {

    private static final OlleCourseEndpointOverrides NONE = new OlleCourseEndpointOverrides(Map.of(), Map.of());

    /** 2026-07-31 판 기준으로 확인한 값. 확인일 2026-09-28. 모두 해당 코스 시작점에서 코스 길이 안에 있다. */
    private static final OlleCourseEndpointOverrides DEFAULTS = new OlleCourseEndpointOverrides(
        Map.of(
            // 10코스 종점 ↔ 11코스 시작. 같은 하모체육공원을 앞 코스는 모슬포항을 붙여 부른다
            "모슬포항하모체육공원", "하모체육공원",
            // 9코스 종점 ↔ 10코스 시작. 화순 올레안내소는 화순금모래해변 들머리에 있다
            "화순제주올레안내소", "화순금모래해변"),
        Map.of(
            // 10-1코스(가파도) 종점. VWorld 에 "하동포구" 로 물으면 경남 하동군이 나온다 — "가파포구" 로 물었다
            "하동포구", new ManualEndPoint(33.165826d, 126.273188d,
                "VWorld 검색 '가파포구' (서귀포시 대정읍 가파리 561-1), 확인 2026-09-28"),
            // 14-1코스 종점
            "오설록녹차밭", new ManualEndPoint(33.3059240323d, 126.2894922148d,
                "TourAPI '오설록 티 뮤지엄', 확인 2026-09-28"),
            // 21코스 종점
            "종달바당", new ManualEndPoint(33.4963286013d, 126.9097146979d,
                "TourAPI '종달리해변' (VWorld 33.496274,126.909433 과 30m 안), 확인 2026-09-28"),
            // 18-2코스 종점
            "추자면사무소", new ManualEndPoint(33.963665d, 126.296061d,
                "VWorld 추자면 대서리 19-1 (18-1 TourAPI 시작점 33.963531,126.296078 과 약 15m), 확인 2026-09-28")));

    public OlleCourseEndpointOverrides {
        aliases = foldKeys(aliases, OlleCourseParser::pointNameKey);
        manualEndPoints = foldKeys(manualEndPoints, UnaryOperator.identity());
    }

    /** 프로덕션이 쓰는 확인된 값. */
    public static OlleCourseEndpointOverrides defaults() {
        return DEFAULTS;
    }

    /** 아무것도 덧대지 않는다 — 순수 체이닝만 본다. */
    public static OlleCourseEndpointOverrides none() {
        return NONE;
    }

    /** 이 종점 지점명의 별칭(체이닝에 쓸 시작 지점명 key). 없으면 null 이다. */
    public String aliasOf(String endPointName) {
        String key = OlleCourseParser.pointNameKey(endPointName);
        return key == null ? null : aliases.get(key);
    }

    /** 이 종점 지점명의 수기 좌표. 없으면 null 이다. */
    public ManualEndPoint manualEndPointOf(String endPointName) {
        String key = OlleCourseParser.pointNameKey(endPointName);
        return key == null ? null : manualEndPoints.get(key);
    }

    /**
     * 사람이 확인한 종점 좌표 한 점.
     *
     * @param lat    위도
     * @param lng    경도
     * @param source 어디서 어떻게 확인했는지. 다음 판본에서 다시 확인할 사람을 위한 근거다
     */
    public record ManualEndPoint(double lat, double lng, String source) {

        public ManualEndPoint {
            Objects.requireNonNull(source, "source");
        }
    }

    /**
     * key 를 {@code pointNameKey} 로 접어 불변 사본을 만든다 — 원문을 붙여 쓰든 띄어 쓰든 같은 항목을
     * 찾게. 접은 뒤 key 가 겹치면 어느 값이 맞는지 알 수 없으므로 실패시킨다.
     */
    private static <V> Map<String, V> foldKeys(Map<String, V> source, UnaryOperator<V> foldValue) {
        Objects.requireNonNull(source, "source");
        Map<String, V> folded = new HashMap<>();
        source.forEach((key, value) -> {
            String foldedKey = Objects.requireNonNull(OlleCourseParser.pointNameKey(key), "key");
            V foldedValue = Objects.requireNonNull(foldValue.apply(Objects.requireNonNull(value, foldedKey)), foldedKey);
            if (folded.putIfAbsent(foldedKey, foldedValue) != null) {
                throw new IllegalArgumentException("duplicate olle point name key: " + foldedKey);
            }
        });
        return Map.copyOf(folded);
    }
}
