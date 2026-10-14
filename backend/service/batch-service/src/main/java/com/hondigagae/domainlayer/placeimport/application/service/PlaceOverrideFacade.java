package com.hondigagae.domainlayer.placeimport.application.service;

import com.hondigagae.domainlayer.placeimport.application.model.PlaceOverrideOutcome;
import com.hondigagae.domainlayer.placeimport.application.port.in.PlaceOverrideUseCase;
import com.hondigagae.domainlayer.placeimport.application.service.processor.PlaceOverrideProcessor;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 장소 보정 유스케이스 (#1434).
 *
 * <p>{@code @Transactional} 을 붙이지 않는다 — 다른 배치 파사드와 같은 규칙이다({@link PlacePetAllowanceReflectFacade}). 쓰기는 행 단위 배치
 * 하나이고, 중간에 끊겨도 다음 실행이 같은 파일로 처음부터 다시 덮는다.
 *
 * <p>지역코드를 받지 않는다. 보정은 id 로 행을 가리키므로 어느 지역으로 돌린 잡에서 불려도 같은 결과가 된다.
 */
@Service
@RequiredArgsConstructor
public class PlaceOverrideFacade implements PlaceOverrideUseCase {

    private final PlaceOverrideProcessor placeOverrideProcessor;

    @Override
    public PlaceOverrideOutcome applyOverrides() {
        return placeOverrideProcessor.applyOverrides();
    }
}
