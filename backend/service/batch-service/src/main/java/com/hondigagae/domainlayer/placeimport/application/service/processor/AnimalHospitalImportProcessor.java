package com.hondigagae.domainlayer.placeimport.application.service.processor;

import com.hondigagae.domainlayer.placeimport.application.port.out.AnimalHospitalBulkPort;
import com.hondigagae.domainlayer.placeimport.application.port.out.CultureFacilityCatalogPort;
import com.hondigagae.domainlayer.placeimport.domain.model.ImportedAnimalHospital;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 동물병원 적재. 긴급 상황 도우미가 쓰는 데이터다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AnimalHospitalImportProcessor {

    private final CultureFacilityCatalogPort cultureFacilityCatalogPort;
    private final AnimalHospitalBulkPort animalHospitalBulkPort;

    public int importHospitals(String sido) {
        List<ImportedAnimalHospital> hospitals = cultureFacilityCatalogPort.readAnimalHospitals(sido);
        if (hospitals.isEmpty()) {
            log.warn("animal hospital import found nothing sido={}", sido);
            return 0;
        }

        animalHospitalBulkPort.upsertAll(hospitals);
        long open24 = hospitals.stream().filter(ImportedAnimalHospital::open24).count();
        log.info("animal hospital import done sido={} rows={} open24={}", sido, hospitals.size(), open24);
        return hospitals.size();
    }
}
