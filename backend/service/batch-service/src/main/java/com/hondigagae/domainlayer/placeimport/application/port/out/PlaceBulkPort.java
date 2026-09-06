package com.hondigagae.domainlayer.placeimport.application.port.out;

import com.hondigagae.domainlayer.placeimport.domain.model.ImportedCultureFacility;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPetRestaurant;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedPlace;
import java.util.List;

/**
 * place 테이블 대량 upsert 계약.
 *
 * <p>원천마다 소유하는 컬럼이 달라 메서드를 나눈다. 관광 API 적재는 반려동물 컬럼을 건드리지 않고
 * (별도 마킹 잡의 소유), 문화정보원 적재는 그 값을 원천에서 직접 가져오므로 함께 갱신한다.
 */
public interface PlaceBulkPort {

    void upsertAll(List<ImportedPlace> places);

    void upsertCultureFacilities(List<ImportedCultureFacility> facilities);

    /**
     * 식약처 등록 업소를 적재한다.
     *
     * <p>동반 가능은 등록 사실 자체로 참이므로 그렇게 넣는다. 반대로 실내/실외와 크기 제한은
     * 원천에 없으므로 <b>추정하지 않고 NULL 로 둔다</b> — "실외"와 "정보 없음"은 다르다.
     */
    void upsertPetRestaurants(List<ImportedPetRestaurant> restaurants);

    /**
     * 지오코딩 실패로 upsert 에서 빠진 식약처 업소의 synced_at 만 갱신한다.
     *
     * <p>delist 판정이 synced_at 기준이라, 원천 파일에 멀쩡히 있는 업소가 좌표 조회 일시 실패
     * (VWorld 서킷 오픈 포함)만으로 폐업 취급되어 내려가면 안 된다.
     */
    void touchPetRestaurantsSyncedAt(List<String> sourceKeys);
}
