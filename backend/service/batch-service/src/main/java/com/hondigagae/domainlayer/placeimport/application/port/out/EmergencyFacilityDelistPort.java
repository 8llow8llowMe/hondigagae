package com.hondigagae.domainlayer.placeimport.application.port.out;

import java.time.LocalDateTime;

/**
 * 원천에서 사라진 긴급 시설 표시 계약. 원천이 문화정보원 하나라 source 구분이 없다.
 * 표시 방식의 이유는 {@link PlaceDelistPort} 와 같다.
 */
public interface EmergencyFacilityDelistPort {

    long countActive();

    int delistStale(LocalDateTime runStartedAt);
}
