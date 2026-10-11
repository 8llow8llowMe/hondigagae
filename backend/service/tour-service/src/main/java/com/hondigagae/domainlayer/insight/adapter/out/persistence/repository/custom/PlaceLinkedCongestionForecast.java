package com.hondigagae.domainlayer.insight.adapter.out.persistence.repository.custom;

import com.hondigagae.domainlayer.insight.adapter.out.persistence.entity.CongestionForecastEntity;

/**
 * 링크를 거쳐 장소에 이어진 집중률 예측 한 건 (#1368).
 *
 * <p>예측 행에는 장소 아이디가 없다 — 장소와는 {@code place_name_link} 로만 이어진다. 여러 장소를 한 번에 조회하면
 * 어느 예측이 어느 장소 것인지 링크 쪽 아이디를 함께 들고 나와야 한다.
 */
public record PlaceLinkedCongestionForecast(Long placeId, CongestionForecastEntity forecast) {

}
