package com.hondigagae.domainlayer.walkcourseimport.application.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum WalkCourseImportErrorCode {

    CSV_NOT_FOUND("WALK_COURSE_IMPORT_001", "올레코스 CSV 파일을 찾을 수 없습니다. (%s)"),
    CSV_READ_FAILED("WALK_COURSE_IMPORT_002", "올레코스 CSV 파일을 읽지 못했습니다. (%s)"),
    CSV_COLUMN_MISSING("WALK_COURSE_IMPORT_003", "올레코스 CSV에 필요한 컬럼이 없습니다. (%s)"),
    CSV_ROW_INVALID("WALK_COURSE_IMPORT_004", "올레코스 CSV 행이 규격을 벗어났습니다. (%s)"),
    TOUR_API_CALL_FAILED("WALK_COURSE_IMPORT_005", "TourAPI 호출에 실패했습니다. (%s)"),
    TOUR_API_RESPONSE_INVALID("WALK_COURSE_IMPORT_006", "TourAPI 응답 형식이 올바르지 않습니다. (%s)"),
    TOUR_API_SERVICE_KEY_MISSING("WALK_COURSE_IMPORT_007", "TourAPI 서비스 키(tour-api.service-key)가 설정되지 않았습니다."),
    TOUR_API_CIRCUIT_OPEN("WALK_COURSE_IMPORT_008", "TourAPI 서킷이 열려 있어 호출을 건너뜁니다."),
    ID_GENERATION_FAILED("WALK_COURSE_IMPORT_009", "산책 코스 식별자 생성에 실패했습니다.");

    private final String code;
    private final String messageTemplate;
}
