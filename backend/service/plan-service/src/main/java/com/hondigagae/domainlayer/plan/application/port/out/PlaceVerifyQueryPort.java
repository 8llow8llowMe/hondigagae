package com.hondigagae.domainlayer.plan.application.port.out;

public interface PlaceVerifyQueryPort {

    /**
     * tour-service 에 장소 존재 여부를 확인한다.
     *
     * @return 존재하면 true, 404 면 false
     */
    boolean existsPlace(long placeId);
}
