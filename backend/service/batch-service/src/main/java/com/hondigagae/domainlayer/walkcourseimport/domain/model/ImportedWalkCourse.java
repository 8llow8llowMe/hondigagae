package com.hondigagae.domainlayer.walkcourseimport.domain.model;

import java.math.BigDecimal;
import lombok.Builder;

/**
 * 적재할 산책 코스 한 건. 공식 수치(CSV)와 TourAPI 매칭분(좌표·이미지)이 합쳐진 모양이다.
 *
 * <p>좌표·contentId·firstImage 는 TourAPI 에 그 코스가 없으면 null 이다(20·18-2코스).
 * 지어내지 않고 비워 둔다 - 조회 쪽(tour-service)이 null 을 "골든타임과 이어지지 않는 코스"로 다룬다.
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
    String baseDate,
    Double lat,
    Double lng,
    Long contentId,
    String firstImage
) {

    public ImportedWalkCourse withCoordinate(Double lat, Double lng, Long contentId, String firstImage) {
        return toBuilder().lat(lat).lng(lng).contentId(contentId).firstImage(firstImage).build();
    }
}
