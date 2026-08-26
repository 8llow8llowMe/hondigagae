package com.hondigagae.domainlayer.placeimport.application.service;

import com.hondigagae.domainlayer.placeimport.application.port.in.PetRestaurantImportUseCase;
import com.hondigagae.domainlayer.placeimport.application.service.processor.PetRestaurantImportProcessor;
import com.hondigagae.domainlayer.placeimport.application.service.processor.PlaceMergeProcessor;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 식약처 음식점 적재 오케스트레이터.
 *
 * <p>적재 뒤 중복 병합을 돌린다. 문화정보원 카페와 겹치는 업소가 실제로 있어서다
 * (제주 기준 이름 대조로 1곳 확인). 병합을 적재 뒤에 해야 새로 들어온 행까지 판정 대상이 된다.
 *
 * <p>{@code @Transactional} 을 붙이지 않는 이유는 다른 적재 파사드와 같다 — 외부 호출과
 * 대량 upsert 를 한 트랜잭션으로 묶으면 커넥션을 오래 잡는다. 재실행이 멱등이라 중간에
 * 실패하면 잡을 다시 돌리면 된다.
 */
@Service
@RequiredArgsConstructor
public class PetRestaurantImportFacade implements PetRestaurantImportUseCase {

    /** 병합 판정 범위. 적재 대상과 같은 지역만 본다. */
    private static final String JEJU_AREA_CODE = "39";

    private final PetRestaurantImportProcessor petRestaurantImportProcessor;
    private final PlaceMergeProcessor placeMergeProcessor;

    @Override
    public int importPetRestaurants(String region) {
        int imported = petRestaurantImportProcessor.importPetRestaurants(region);
        placeMergeProcessor.mergeDuplicates(JEJU_AREA_CODE);
        return imported;
    }
}
