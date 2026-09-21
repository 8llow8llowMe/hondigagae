package com.hondigagae.domainlayer.walkcourseimport.domain.model;

import java.math.BigDecimal;
import lombok.Builder;

/**
 * 적재할 산책 코스 한 건. 공식 수치(CSV)와 TourAPI 매칭분(좌표·이미지)이 합쳐진 모양이다.
 *
 * <p>좌표·contentId·firstImage 는 TourAPI 에 그 코스가 없으면 null 이다(20·18-2코스).
 * 지어내지 않고 비워 둔다 - 조회 쪽(tour-service)이 null 을 "골든타임과 이어지지 않는 코스"로 다룬다.
 *
 * @param startPointName 시작 지점명. {@code startEndPoint} 원문을 가른 것이고 <b>원문 표기를
 *                       그대로 둔다</b> — 매칭용 정규화는 {@code OlleCourseParser.pointNameKey}
 *                       안에만 있다. 원문에 표기가 둘인 지점(`제주민속촌주차장 입구`)을 화면에서
 *                       임의로 고쳐 부르지 않기 위해서다 (#816)
 * @param endPointName   종점 지점명. 같은 규칙이다
 * @param endLat         종점 위도. {@code OlleCourseEndpointResolver} 가 인접 코스의 시작점에서
 *                       끌어온다. 그 지점에서 출발하는 코스가 없으면 null 이다 — 지어내지 않는다
 * @param endLng         종점 경도. 같은 규칙이다
 */
@Builder(toBuilder = true)
public record ImportedWalkCourse(
    long id,
    String courseKey,
    String courseNo,
    String variant,
    int courseOrder,
    String name,
    BigDecimal distanceKm,
    String durationText,
    Integer durationMaxMinutes,
    String startEndPoint,
    String startPointName,
    String endPointName,
    String baseDate,
    Double lat,
    Double lng,
    Double endLat,
    Double endLng,
    Long contentId,
    String firstImage
) {

    public ImportedWalkCourse withCoordinate(Double lat, Double lng, Long contentId, String firstImage) {
        return toBuilder().lat(lat).lng(lng).contentId(contentId).firstImage(firstImage).build();
    }

    public ImportedWalkCourse withEndCoordinate(Double endLat, Double endLng) {
        return toBuilder().endLat(endLat).endLng(endLng).build();
    }
}
