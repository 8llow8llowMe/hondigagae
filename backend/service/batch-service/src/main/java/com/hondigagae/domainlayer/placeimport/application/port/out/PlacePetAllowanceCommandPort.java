package com.hondigagae.domainlayer.placeimport.application.port.out;

import com.hondigagae.domainlayer.placeimport.application.port.out.query.PlacePetAllowanceEvidenceQueryResult;
import com.hondigagae.domainlayer.placeimport.domain.model.ReflectedPetAllowance;
import java.util.List;

/**
 * TourAPI 장소의 동반 가능 여부 · 크기 제한을 근거에서 다시 채우는 계약 (#886).
 *
 * <p>대상은 TourAPI 노출 행뿐이다({@code source='TOUR_API' AND merged_into_id IS NULL AND delisted_at IS NULL}).
 * 문화정보원 · 식약처 행의 두 컬럼은 각 원천 적재가 소유한다.
 */
public interface PlacePetAllowanceCommandPort {

    /** 대상 행 전부와 그 근거(place_pet_info · 흡수된 행)를 읽는다. 대상 한 곳당 한 건. */
    List<PlacePetAllowanceEvidenceQueryResult> findTourApiEvidences();

    /**
     * 계산한 값으로 place 행의 두 컬럼을 덮는다. 대상 조건을 한 번 더 걸어 그사이 병합 · delist 된 행은 건드리지 않는다.
     *
     * @return 갱신한 행 수
     */
    int updatePetAllowances(List<ReflectedPetAllowance> reflections);
}
