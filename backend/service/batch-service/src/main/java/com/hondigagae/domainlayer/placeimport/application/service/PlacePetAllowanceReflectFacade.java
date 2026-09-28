package com.hondigagae.domainlayer.placeimport.application.service;

import com.hondigagae.domainlayer.placeimport.application.model.PetAllowanceReflectOutcome;
import com.hondigagae.domainlayer.placeimport.application.port.in.PlacePetAllowanceReflectUseCase;
import com.hondigagae.domainlayer.placeimport.application.service.processor.PlacePetAllowanceReflectProcessor;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 동반 가능 여부 재계산 유스케이스 (#886).
 *
 * <p>{@code @Transactional} 을 붙이지 않는다 — 다른 배치 파사드와 같은 규칙이다({@link PlaceMergeFacade}). 한 실행이
 * 중간에 끊겨도 결과를 처음부터 다시 계산하므로 다음 실행이 나머지를 채운다.
 *
 * <p>지역코드를 받지 않는다. 대상이 "TourAPI 노출 행 전부" 로 정해져 있고 결과가 근거만의 함수라, 어느 지역으로
 * 돌린 잡에서 불려도 같은 결과가 된다.
 */
@Service
@RequiredArgsConstructor
public class PlacePetAllowanceReflectFacade implements PlacePetAllowanceReflectUseCase {

    private final PlacePetAllowanceReflectProcessor placePetAllowanceReflectProcessor;

    @Override
    public PetAllowanceReflectOutcome reflectPetAllowances() {
        return placePetAllowanceReflectProcessor.reflectPetAllowances();
    }
}
