package com.hondigagae.domainlayer.insight.application.exception;

/**
 * 여행 인사이트 조회 검증 메시지 카탈로그 (INSIGHT_1xx).
 * 형식은 {@code "코드:사용자 메시지"} - ValidationErrorSupport 가 접두어를 분리한다.
 *
 * <p>실제로 쓰이는 것만 둔다. 쓰지 않는 코드를 남겨 두면 "검증이 있는 줄" 알게 되고,
 * 나중에 그 코드를 근거로 클라이언트가 분기하는 일이 생긴다.
 *
 * <p>좌표/반경/개수 검증이 없는 이유는 이 컨텍스트가 그 값을 요청으로 받지 않기 때문이다 -
 * 좌표는 장소에서 읽고, 대안 검색 반경과 개수는 서버 프로퍼티({@code insight.*})가 정한다.
 */
public final class InsightValidationMessage {

    public static final String PLACE_ID_INVALID = "INSIGHT_101:장소 아이디는 1 이상만 가능합니다.";

    private InsightValidationMessage() {
    }
}
