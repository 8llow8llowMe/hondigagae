package com.hondigagae.domainlayer.congestionimport.application.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum CongestionImportErrorCode {

    SERVICE_KEY_MISSING("CONGESTION_IMPORT_001", "관광공사 서비스 키가 설정되지 않았습니다."),
    API_CALL_FAILED("CONGESTION_IMPORT_002", "집중률 예측 API 호출에 실패했습니다. (%s)"),
    RESPONSE_INVALID("CONGESTION_IMPORT_003", "집중률 예측 API 응답을 해석할 수 없습니다. (%s)");

    private final String code;
    private final String message;
}
