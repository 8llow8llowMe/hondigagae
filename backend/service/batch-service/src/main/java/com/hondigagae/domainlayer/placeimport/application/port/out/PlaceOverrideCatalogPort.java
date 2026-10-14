package com.hondigagae.domainlayer.placeimport.application.port.out;

import com.hondigagae.domainlayer.placeimport.domain.model.PlaceOverride;
import java.util.List;

/**
 * 근거를 적은 장소 보정 목록을 읽는 계약 (#1434). 원천은 배포물에 든 보정 파일({@code place-overrides.yml})이다.
 */
public interface PlaceOverrideCatalogPort {

    /**
     * 보정 항목 전부. 파일이 읽히지 않거나 항목 하나라도 규칙을 어기면 {@code PLACE_OVERRIDE_INVALID} 로 실패한다 — 맞는 항목만 골라 돌려주지 않는다.
     */
    List<PlaceOverride> readOverrides();
}
