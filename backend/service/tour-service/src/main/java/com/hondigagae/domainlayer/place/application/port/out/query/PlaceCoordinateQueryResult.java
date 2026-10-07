package com.hondigagae.domainlayer.place.application.port.out.query;

import java.math.BigDecimal;

/**
 * 거리순 목록이 거리를 재는 데 필요한 장소 3컬럼 (#1202).
 *
 * <p>거리순은 필터에 맞는 후보 <b>전량</b>의 거리를 재야 순서를 정할 수 있다. 엔티티 전체(개요 TEXT 등)를 끌어오지 않도록
 * 아이디와 좌표만 projection 으로 가져온다. 이 값을 주는 조회는 좌표가 둘 다 있는 행만 돌려주므로 {@code lat}·{@code lng}
 * 는 null 이 아니다.
 */
public record PlaceCoordinateQueryResult(long placeId, BigDecimal lat, BigDecimal lng) {

}
