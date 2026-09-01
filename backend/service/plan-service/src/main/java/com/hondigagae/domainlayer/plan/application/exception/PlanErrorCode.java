package com.hondigagae.domainlayer.plan.application.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum PlanErrorCode {

    NOT_FOUND_PLAN("PLAN_001", "존재하지 않는 여행 일정입니다.", HttpStatus.NOT_FOUND),
    PLAN_DAY_OUT_OF_RANGE("PLAN_002", "여행 기간을 벗어난 일자입니다.", HttpStatus.BAD_REQUEST),
    PLAN_DATE_RANGE_INVALID("PLAN_003", "여행 시작일은 종료일보다 늦을 수 없습니다.", HttpStatus.BAD_REQUEST),
    NOT_FOUND_PLAN_PLACE("PLAN_004", "일정 항목의 장소를 찾을 수 없습니다.", HttpStatus.BAD_REQUEST),
    NOT_FOUND_PLAN_ITEM("PLAN_005", "존재하지 않는 일정 항목입니다.", HttpStatus.NOT_FOUND),
    ITEM_DAY_REQUIRED("PLAN_006", "일정 항목의 일차는 필수입니다.", HttpStatus.BAD_REQUEST),
    ITEM_SEQUENCE_DUPLICATED("PLAN_007", "같은 일차에 순서가 중복된 항목이 있습니다.", HttpStatus.BAD_REQUEST),
    PLAN_PERIOD_SHRINK_CONFLICT("PLAN_008", "줄어든 여행 기간 밖에 일정 항목이 남아 있습니다. 해당 일차의 항목을 먼저 정리해 주세요.", HttpStatus.BAD_REQUEST),
    INVALID_REQUEST("PLAN_100", "요청 값이 올바르지 않습니다.", HttpStatus.BAD_REQUEST),
    PARAMETER_TYPE_INVALID("PLAN_115", "요청 파라미터 형식이 올바르지 않습니다.", HttpStatus.BAD_REQUEST),
    PARAMETER_REQUIRED("PLAN_116", "필수 요청 파라미터가 누락되었습니다.", HttpStatus.BAD_REQUEST),
    INTERNAL_SERVICE_UNAVAILABLE("PLAN_900", "내부 서비스 연동에 실패했습니다. 잠시 후 다시 시도해주세요.", HttpStatus.SERVICE_UNAVAILABLE);

    private final String code;
    private final String message;
    private final HttpStatus httpStatus;
}
