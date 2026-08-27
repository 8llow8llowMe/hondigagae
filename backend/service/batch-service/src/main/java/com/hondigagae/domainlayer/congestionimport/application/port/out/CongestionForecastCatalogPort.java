package com.hondigagae.domainlayer.congestionimport.application.port.out;

import com.hondigagae.domainlayer.congestionimport.application.port.out.query.CongestionCatalogQueryResult;
import com.hondigagae.domainlayer.congestionimport.domain.enums.JejuLegalRegion;

/**
 * 집중률 예측 원천 조회 계약. 포트 이름에 제공처를 쓰지 않는다 (external-api-guide §3).
 */
public interface CongestionForecastCatalogPort {

    CongestionCatalogQueryResult fetchConcentrationRates(JejuLegalRegion region, int pageNo, int numOfRows);
}
