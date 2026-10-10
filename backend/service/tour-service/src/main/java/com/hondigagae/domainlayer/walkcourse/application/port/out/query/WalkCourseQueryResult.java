package com.hondigagae.domainlayer.walkcourse.application.port.out.query;

import java.math.BigDecimal;
import lombok.Builder;

@Builder
public record WalkCourseQueryResult(
    long walkCourseId,
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
    Double lat,
    Double lng,
    Double endLat,
    Double endLng,
    String firstImage,
    String baseDate
) {
}
