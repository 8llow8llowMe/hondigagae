package com.hondigagae.domainlayer.place.application.port.in;

import com.hondigagae.domainlayer.place.adapter.in.internal.dto.PlaceCandidateInternalResponse;
import java.util.List;

public interface PlaceInternalUseCase {

    /** 주어진 아이디 중 노출 가능한(병합·delisted 아님) 장소 아이디만 돌려준다. */
    List<Long> findVisiblePlaceIds(List<Long> placeIds);

    /** 아이디로 후보 요약을 준다 (ai-service 필수 포함 장소용). 노출 불가 장소는 빠진다. */
    List<PlaceCandidateInternalResponse> findPlaceCandidates(List<Long> placeIds);
}
