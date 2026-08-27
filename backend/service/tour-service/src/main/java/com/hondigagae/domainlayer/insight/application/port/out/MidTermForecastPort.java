package com.hondigagae.domainlayer.insight.application.port.out;

import com.hondigagae.domainlayer.insight.application.port.out.query.MidTermForecastQueryResult;
import com.hondigagae.domainlayer.insight.domain.enums.MidTermRegion;

/**
 * 중기예보 조회 계약. 단기예보({@link WeatherObservationPort})가 닿지 않는 날짜를 메운다.
 *
 * <p>포트를 따로 둔 이유는 <b>위치 지정 방식이 다르기 때문</b>이다. 단기예보는 격자를 받고
 * 중기예보는 예보구역을 받는다. 한 포트에 억지로 합치면 호출부가 "지금은 격자인가 구역인가"를
 * 알아야 하고, 그 순간 두 원천의 차이가 application 계층으로 새어 나온다.
 *
 * <p>반환 타입이 {@code List<WeatherForecast>} 가 아니라 일자별 집계인 것도 원천의 성질이다 -
 * 중기예보에는 시각별 데이터가 없다.
 */
public interface MidTermForecastPort {

    /**
     * 예보구역의 중기예보(대략 D+3 ~ D+10)를 일자순으로 가져온다.
     *
     * <p>육상예보(날씨/강수확률)와 기온을 각각 받아 날짜로 조인한 결과다. 한쪽만 성공하면
     * 채울 수 있는 것만 채운다 - 기온만 있어도 더위/추위 판정은 성립한다.
     *
     * @return 예보가 없으면 빈 목록을 담은 결과. 호출 실패는 {@code InsightException} 으로 던진다
     */
    MidTermForecastQueryResult fetchMidTermForecast(MidTermRegion region);
}
