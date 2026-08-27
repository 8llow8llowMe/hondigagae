package com.hondigagae.domainlayer.place.application.port.in;

import java.util.List;

public interface PlaceInternalUseCase {

    /** 주어진 아이디 중 노출 가능한(병합·delisted 아님) 장소 아이디만 돌려준다. */
    List<Long> findVisiblePlaceIds(List<Long> placeIds);
}
