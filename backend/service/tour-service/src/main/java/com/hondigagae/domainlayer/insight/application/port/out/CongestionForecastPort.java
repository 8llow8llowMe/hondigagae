package com.hondigagae.domainlayer.insight.application.port.out;

import com.hondigagae.domainlayer.insight.domain.model.CongestionSnapshot;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Map;

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

    /**
     * 여러 장소의 그 날짜 혼잡도를 한 번에 (#1368). 장소 추천이 후보 전부의 혼잡도를 볼 때 장소마다 부르지 않게 한다.
     *
     * <p>요청한 장소 아이디는 <b>전부</b> 키로 들어 있다. 연결된 예측이 없는 장소는 {@code UNKNOWN} 스냅샷이다 —
     * {@link #findByPlaceAndDate} 와 같은 규칙이다.
     */
    Map<Long, CongestionSnapshot> findByPlacesAndDate(Collection<Long> placeIds, LocalDate date);
}
