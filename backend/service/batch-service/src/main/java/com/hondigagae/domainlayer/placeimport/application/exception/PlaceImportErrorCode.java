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
    TOUR_API_SERVICE_KEY_MISSING("PLACE_IMPORT_003", "TourAPI 서비스 키(tour-api.service-key)가 설정되지 않았습니다."),
    PLACE_ID_GENERATION_FAILED("PLACE_IMPORT_004", "장소 식별자 생성에 실패했습니다."),
    CULTURE_CSV_NOT_FOUND("PLACE_IMPORT_005", "문화시설 CSV 파일을 찾을 수 없습니다. (%s)"),
    CULTURE_CSV_READ_FAILED("PLACE_IMPORT_006", "문화시설 CSV 파일을 읽지 못했습니다. (%s)"),
    CULTURE_CSV_COLUMN_MISSING("PLACE_IMPORT_007", "문화시설 CSV에 필요한 컬럼이 없습니다. (%s)"),
    MFDS_DOWNLOAD_FAILED("PLACE_IMPORT_008", "식약처 반려동물 동반출입 음식점 파일을 받지 못했습니다. (%s)"),
    MFDS_FILE_READ_FAILED("PLACE_IMPORT_009", "식약처 반려동물 동반출입 음식점 파일을 읽지 못했습니다. (%s)"),
    MFDS_COLUMN_MISSING("PLACE_IMPORT_010", "식약처 파일에 필요한 컬럼이 없습니다. (%s)"),
    GEOCODING_KEY_MISSING("PLACE_IMPORT_011", "VWorld 지오코더 키(vworld.api-key)가 설정되지 않았습니다.");

    private final String code;
    private final String message;
}
