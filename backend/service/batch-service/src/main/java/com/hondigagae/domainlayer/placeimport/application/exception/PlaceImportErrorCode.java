package com.hondigagae.domainlayer.placeimport.application.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * batch-service는 웹 계층이 없어 HttpStatus는 두지 않는다.
 * 커스텀 코드는 배치 실패 로그에서 원인을 식별하는 용도로 사용한다.
 */
@Getter
@RequiredArgsConstructor
public enum PlaceImportErrorCode {

    TOUR_API_CALL_FAILED("PLACE_IMPORT_001", "TourAPI 호출에 실패했습니다. (%s)"),
    TOUR_API_RESPONSE_INVALID("PLACE_IMPORT_002", "TourAPI 응답 형식이 올바르지 않습니다. (%s)"),
    TOUR_API_SERVICE_KEY_MISSING("PLACE_IMPORT_003", "TourAPI 서비스 키(tour-api.service-key)가 설정되지 않았습니다.");

    private final String code;
    private final String message;
}
