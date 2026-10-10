package com.hondigagae.domainlayer.insight.adapter.out.persistence.repository.custom;

import com.hondigagae.domainlayer.insight.adapter.out.persistence.entity.CongestionForecastEntity;
import com.hondigagae.shared.travel.insight.NameLinkSourceType;
import java.util.List;

/**
 * 장소에 연결된 집중률 예측 조회. {@code place_name_link} 를 조인해 잇는다.
 */
public interface CongestionForecastCustomRepository {

    List<CongestionForecastEntity> findLinkedByPlaceIdAndDateRange(
        long placeId, String fromYmd, String toYmd, NameLinkSourceType sourceType);
}
