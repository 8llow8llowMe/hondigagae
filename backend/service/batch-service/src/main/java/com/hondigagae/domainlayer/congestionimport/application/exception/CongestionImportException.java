package com.hondigagae.domainlayer.congestionimport.application.exception;

import lombok.Getter;

/**
 * 생성자 형태는 배치 형제인 {@code PlaceImportException} 과 같다 —
 * 상세를 {@code Object... args} 로 받아 메시지의 자리 표시자에 넣는다.
 */
@Getter
public class CongestionImportException extends RuntimeException {

    private final CongestionImportErrorCode errorCode;

    public CongestionImportException(CongestionImportErrorCode errorCode, Object... messageArgs) {
        super("[%s] %s".formatted(errorCode.getCode(), errorCode.getMessage().formatted(messageArgs)));
        this.errorCode = errorCode;
    }

    public CongestionImportException(CongestionImportErrorCode errorCode, Throwable cause, Object... messageArgs) {
        super("[%s] %s".formatted(errorCode.getCode(), errorCode.getMessage().formatted(messageArgs)), cause);
        this.errorCode = errorCode;
    }
}
