package com.hondigagae.domainlayer.walkcourseimport.application.port.out.query;

import lombok.Builder;

/** TourAPI 올레 항목에서 뽑은 시작점 좌표·부가 정보. */
@Builder
public record OlleCourseCoordinateQueryResult(
    Double lat,
    Double lng,
    Long contentId,
    String firstImage
) {
}
