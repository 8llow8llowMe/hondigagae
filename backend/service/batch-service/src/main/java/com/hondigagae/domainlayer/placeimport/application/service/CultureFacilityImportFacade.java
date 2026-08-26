package com.hondigagae.domainlayer.placeimport.application.service;

import com.hondigagae.domainlayer.placeimport.application.port.in.CultureFacilityImportUseCase;
import com.hondigagae.domainlayer.placeimport.application.service.processor.AnimalHospitalImportProcessor;
import com.hondigagae.domainlayer.placeimport.application.service.processor.CultureFacilityImportProcessor;
import com.hondigagae.domainlayer.placeimport.application.service.processor.PlaceMergeProcessor;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 문화정보원 문화시설 적재 오케스트레이터.
 *
 * <p>여행 시설 적재 → 중복 병합 → 동물병원 적재를 잇달아 수행한다.
 * 병합은 적재 뒤에 해야 새로 들어온 행까지 판정 대상이 된다.
 *
 * <p>{@code @Transactional}을 붙이지 않는 이유는 {@code PlaceImportFacade} 와 같다 —
 * 파일 파싱과 대량 upsert 를 한 트랜잭션으로 묶으면 커넥션을 오래 잡는다. 재실행이 멱등이라
 * 중간에 실패하면 잡을 다시 돌리면 된다.
 */
@Service
@RequiredArgsConstructor
public class CultureFacilityImportFacade implements CultureFacilityImportUseCase {

    /** 병합 판정 범위. 적재 대상과 같은 지역만 본다. */
    private static final String JEJU_AREA_CODE = "39";

    private final CultureFacilityImportProcessor cultureFacilityImportProcessor;
    private final AnimalHospitalImportProcessor animalHospitalImportProcessor;
    private final PlaceMergeProcessor placeMergeProcessor;

    @Override
    public int importFacilities(String sido) {
        int imported = cultureFacilityImportProcessor.importFacilities(sido);
        placeMergeProcessor.mergeDuplicates(JEJU_AREA_CODE);
        // 같은 파일에 동물병원이 함께 들어 있어 한 번 읽는 김에 같이 적재한다.
        animalHospitalImportProcessor.importHospitals(sido);
        return imported;
    }
}
