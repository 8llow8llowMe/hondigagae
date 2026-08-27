package com.hondigagae.domainlayer.place.adapter.out.persistence.repository.custom;

import com.hondigagae.domainlayer.place.adapter.out.persistence.entity.PlaceEntity;
import com.hondigagae.domainlayer.place.application.model.NearbyPlaceCriteria;
import com.hondigagae.domainlayer.place.application.model.PlaceSearchCriteria;
import java.util.List;
import org.springframework.data.domain.Slice;

/**
 * 조건이 동적으로 켜지고 꺼지는 장소 검색.
 *
 * <p>JPQL 로는 {@code (:param is null or ...)} 가 조건 수만큼 늘어서 쿼리가 조건 대장이 된다.
 * QueryDSL 로 옮겨 null 인 조건은 아예 where 에 넣지 않는다.
 */
public interface PlaceCustomRepository {

    /** 목록 검색. 커서(lastPlaceId) 기반이라 Slice 로 돌려준다. */
    Slice<PlaceEntity> searchByCriteria(PlaceSearchCriteria criteria);

    /** 좌표 사각 범위 1차 필터. 정확한 원형 반경과 거리 정렬은 호출한 쪽이 한다. */
    List<PlaceEntity> searchNearby(NearbyPlaceCriteria criteria);
}
