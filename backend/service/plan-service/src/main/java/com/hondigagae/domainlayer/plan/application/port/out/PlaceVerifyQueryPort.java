package com.hondigagae.domainlayer.plan.application.port.out;

import java.util.Collection;
import java.util.Set;

public interface PlaceVerifyQueryPort {

    /**
     * tour-service 에 장소 존재를 한 번에 확인한다.
     *
     * <p>항목마다 따로 확인하면 일정 저장 한 번에 원격 호출이 항목 수만큼 생긴다.
     * 원천에서 사라진(delisted) 장소는 존재하지 않는 것으로 온다 — 새 일정 항목이
     * 그런 장소를 참조하게 두지 않는다.
     *
     * @return 노출 가능한 장소 아이디의 집합
     */
    Set<Long> findVisiblePlaceIds(Collection<Long> placeIds);
}
