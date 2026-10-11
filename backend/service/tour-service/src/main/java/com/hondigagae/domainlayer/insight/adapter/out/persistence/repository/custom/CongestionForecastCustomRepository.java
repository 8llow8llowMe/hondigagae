package com.hondigagae.domainlayer.insight.adapter.out.persistence.repository.custom;

import com.hondigagae.domainlayer.insight.adapter.out.persistence.entity.CongestionForecastEntity;
import com.hondigagae.shared.travel.insight.NameLinkSourceType;
import java.util.Collection;
import java.util.List;

/**
 * 장소에 연결된 집중률 예측 조회. {@code place_name_link} 를 조인해 잇는다.
 */
public interface CongestionForecastCustomRepository {

    List<CongestionForecastEntity> findLinkedByPlaceIdAndDateRange(
        long placeId, String fromYmd, String toYmd, NameLinkSourceType sourceType);

    /** 여러 장소의 하루치 예측을 한 쿼리로 (#1368). 장소 아이디 오름차순, 같은 장소 안에서는 예측 아이디 오름차순이다. */
    List<PlaceLinkedCongestionForecast> findLinkedByPlaceIdsAndDate(
        Collection<Long> placeIds, String baseYmd, NameLinkSourceType sourceType);
}
