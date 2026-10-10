package com.hondigagae.domainlayer.insight.application.info;

import com.hondigagae.domainlayer.insight.domain.model.CongestionSnapshot;
import java.time.LocalDate;
import java.util.List;
import lombok.Builder;

/**
 * 장소의 기간별 혼잡도.
 *
 * <p>요청 기간을 함께 들고 간다 - 프레젠터가 응답에 그대로 실어야 클라이언트가 날짜 축을
 * 그릴 수 있다.
 */
@Builder
public record PlaceCongestionInfo(
    long placeId,
    LocalDate fromDate,
    LocalDate toDate,
    List<CongestionSnapshot> snapshots
) {

}
