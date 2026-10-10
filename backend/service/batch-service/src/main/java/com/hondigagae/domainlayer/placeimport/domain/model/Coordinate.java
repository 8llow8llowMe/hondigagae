package com.hondigagae.domainlayer.placeimport.domain.model;

import java.math.BigDecimal;

/**
 * WGS84 좌표. 지오코딩 결과를 담는 최소 값 객체다.
 */
public record Coordinate(BigDecimal lat, BigDecimal lng) {

}
