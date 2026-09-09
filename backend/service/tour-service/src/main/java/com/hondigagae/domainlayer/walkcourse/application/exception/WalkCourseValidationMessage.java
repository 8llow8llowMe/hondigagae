package com.hondigagae.domainlayer.walkcourse.application.exception;

/**
 * 검증 코드는 1xx 대역이다. 프레임워크 공통(TYPE_INVALID 등)은 {@link WalkCourseErrorCode} 의
 * 대역 끝(113~)을 쓴다.
 */
public final class WalkCourseValidationMessage {

    public static final String MAX_DISTANCE_RANGE_INVALID = "WALKCOURSE_101:최대 거리는 0.1 ~ 50km 범위여야 합니다.";

    private WalkCourseValidationMessage() {
    }
}
