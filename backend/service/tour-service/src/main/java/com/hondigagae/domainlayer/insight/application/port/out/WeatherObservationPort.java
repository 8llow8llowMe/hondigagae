package com.hondigagae.domainlayer.insight.application.port.out;

import com.hondigagae.common.geo.KmaGridPoint;
import com.hondigagae.domainlayer.insight.application.port.out.query.WeatherObservationQueryResult;

/**
 * 날씨 관측/예보 조회 계약.
 *
 * <p>포트 이름에 제공처(기상청)를 쓰지 않는다. 데이터 책임으로 명명한다 (external-api-guide §3).
 * 구현은 {@code adapter/out/client} 뒤에 숨는다.
 */
public interface WeatherObservationPort {

    /**
     * 격자 한 곳의 단기예보 전체를 시각순으로 가져온다.
     *
     * <p>한 번의 호출이 그 격자의 약 3일치를 통째로 준다. 시각별로 잘라 여러 번 부르지 않는다 -
     * 공공 API 쿼터가 그것을 허락하지 않는다.
     *
     * @return 예보가 없으면 빈 목록을 담은 결과. 호출 실패는 {@code InsightException} 으로 던진다
     */
    WeatherObservationQueryResult fetchVillageForecast(KmaGridPoint grid);
}
