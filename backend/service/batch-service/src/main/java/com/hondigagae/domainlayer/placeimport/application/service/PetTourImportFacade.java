package com.hondigagae.domainlayer.placeimport.application.service;

import com.hondigagae.domainlayer.placeimport.application.port.in.PetTourImportUseCase;
import com.hondigagae.domainlayer.placeimport.application.service.processor.PetTourImportProcessor;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 반려동물 동반 조건 적재 (#877).
 *
 * <p>적재 지표({@code place_import_rows})를 기록하지 않는다 — 그 지표의 {@code source} 라벨은 place
 * 행을 만드는 원천 셋이고, 이 잡은 place 가 아니라 place_pet_info 를 채운다. 건수는 프로세서의 완료
 * 로그 한 줄이 말한다.
 */
@Service
@RequiredArgsConstructor
public class PetTourImportFacade implements PetTourImportUseCase {

    private final PetTourImportProcessor petTourImportProcessor;

    @Override
    public int importPetTourInfos(String areaCode) {
        return petTourImportProcessor.importPetTourInfos(areaCode);
    }
}
