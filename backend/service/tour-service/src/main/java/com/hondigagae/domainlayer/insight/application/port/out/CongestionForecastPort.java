package com.hondigagae.domainlayer.insight.application.port.out;

import com.hondigagae.domainlayer.insight.domain.model.CongestionSnapshot;
import java.time.LocalDate;
import java.util.List;

/**
 * 혼잡도 예측 조회 계약.
 *
 * <p>실시간 호출이 아니라 batch-service 가 적재한 DB 를 읽는다. 관광공사 API 는 개발계정
 * 일 1,000건 제한이 있어 조회 때마다 부를 수 없다 (external-api-guide §2).
 *
 * <p>연결된 데이터가 없으면 {@code UNKNOWN} 스냅샷을 준다. 빈 목록으로 주면 호출부가
 * "혼잡하지 않다"로 잘못 읽을 여지가 생긴다.
 */
public interface CongestionForecastPort {

    CongestionSnapshot findByPlaceAndDate(long placeId, LocalDate date);

    List<CongestionSnapshot> findByPlaceAndDateRange(long placeId, LocalDate from, LocalDate to);
}
