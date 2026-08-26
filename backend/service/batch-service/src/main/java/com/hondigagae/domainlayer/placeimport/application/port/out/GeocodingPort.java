package com.hondigagae.domainlayer.placeimport.application.port.out;

import com.hondigagae.domainlayer.placeimport.domain.model.Coordinate;
import java.util.Optional;

/**
 * 주소 → 좌표 변환 계약.
 *
 * <p>어떤 지오코더를 쓰는지는 adapter 안에 갇힌다. 변환에 실패한 주소는 예외가 아니라
 * 빈 값이다 — 한 건이 안 풀린다고 배치 전체를 멈출 이유가 없다.
 */
public interface GeocodingPort {

    Optional<Coordinate> geocode(String address);
}
