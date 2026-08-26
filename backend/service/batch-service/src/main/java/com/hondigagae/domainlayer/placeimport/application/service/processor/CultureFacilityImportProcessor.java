package com.hondigagae.domainlayer.placeimport.application.service.processor;

import com.hondigagae.domainlayer.placeimport.application.port.out.CultureFacilityCatalogPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceBulkPort;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedCultureFacility;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 문화정보원 문화시설 적재.
 *
 * <p>파일 하나를 통째로 읽어 upsert 한다. 제주 기준 1,191행 중 여행 대상은 171행 수준이라
 * 페이지 분할 없이 한 번에 처리해도 메모리 부담이 없다. 전국으로 넓히면 시도 단위로 나눠 호출한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CultureFacilityImportProcessor {

    private final CultureFacilityCatalogPort cultureFacilityCatalogPort;
    private final PlaceBulkPort placeBulkPort;

    public int importFacilities(String sido) {
        List<ImportedCultureFacility> facilities = cultureFacilityCatalogPort.readTravelFacilities(sido);
        if (facilities.isEmpty()) {
            log.warn("culture facility import found nothing sido={}", sido);
            return 0;
        }

        placeBulkPort.upsertCultureFacilities(facilities);
        log.info("culture facility import done sido={} upserted={}", sido, facilities.size());
        return facilities.size();
    }
}
