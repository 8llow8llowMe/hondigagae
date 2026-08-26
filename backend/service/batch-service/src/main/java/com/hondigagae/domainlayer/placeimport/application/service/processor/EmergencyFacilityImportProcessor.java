package com.hondigagae.domainlayer.placeimport.application.service.processor;

import com.hondigagae.domainlayer.placeimport.application.port.out.CultureFacilityCatalogPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.EmergencyFacilityBulkPort;
import com.hondigagae.domainlayer.placeimport.domain.enums.EmergencyFacilityTypeCode;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedEmergencyFacility;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 긴급 시설(동물병원·동물약국) 적재. 긴급 상황 도우미가 쓰는 데이터다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class EmergencyFacilityImportProcessor {

    private final CultureFacilityCatalogPort cultureFacilityCatalogPort;
    private final EmergencyFacilityBulkPort emergencyFacilityBulkPort;

    public int importFacilities(String sido) {
        List<ImportedEmergencyFacility> facilities = cultureFacilityCatalogPort.readEmergencyFacilities(sido);
        if (facilities.isEmpty()) {
            log.warn("emergency facility import found nothing sido={}", sido);
            return 0;
        }

        emergencyFacilityBulkPort.upsertAll(facilities);

        // 종류별 건수와 24시간 운영 수를 남긴다. 원천 품질이 흔들리면 여기서 먼저 드러난다.
        Map<EmergencyFacilityTypeCode, Long> byType = facilities.stream()
            .collect(Collectors.groupingBy(ImportedEmergencyFacility::facilityType, Collectors.counting()));
        Map<EmergencyFacilityTypeCode, Long> open24ByType = facilities.stream()
            .filter(ImportedEmergencyFacility::open24)
            .collect(Collectors.groupingBy(ImportedEmergencyFacility::facilityType, Collectors.counting()));
        long withHours = facilities.stream().filter(f -> f.operatingHours() != null).count();

        log.info("emergency facility import done sido={} rows={} byType={} open24ByType={} withOperatingHours={}",
            sido, facilities.size(), byType, open24ByType, withHours);
        return facilities.size();
    }

}
