package com.hondigagae.domainlayer.placeimport.application.port.out;

import com.hondigagae.domainlayer.placeimport.domain.model.ImportedCultureFacility;
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
}
