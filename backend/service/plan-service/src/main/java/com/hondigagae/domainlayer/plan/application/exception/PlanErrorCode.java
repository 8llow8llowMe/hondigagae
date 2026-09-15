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
    PLAN_PERIOD_TOO_LONG("PLAN_009", "여행 기간은 최대 30일까지 만들 수 있습니다.", HttpStatus.BAD_REQUEST),
    PLAN_PERIOD_SHRINK_CONFLICT("PLAN_008", "줄어든 여행 기간 밖에 일정 항목이 남아 있습니다. 해당 일차의 항목을 먼저 정리해 주세요.", HttpStatus.BAD_REQUEST),
    PET_REQUIRED("PLAN_010", "동행할 반려견을 지정하거나 대표 반려견을 등록해 주세요.", HttpStatus.BAD_REQUEST),
    NOT_FOUND_PET("PLAN_011", "존재하지 않거나 본인 소유가 아닌 반려견이 있습니다.", HttpStatus.BAD_REQUEST),
    PACKING_ITEM_NAME_DUPLICATED("PLAN_012", "이미 같은 이름의 준비물이 있습니다.", HttpStatus.CONFLICT),
    PACKING_ITEM_LIMIT_EXCEEDED("PLAN_013", "준비물은 일정당 최대 50개까지 저장할 수 있습니다.", HttpStatus.BAD_REQUEST),
    NOT_FOUND_PACKING_ITEM("PLAN_014", "존재하지 않는 준비물 항목입니다.", HttpStatus.NOT_FOUND),
    REVIEW_NOT_FOUND("PLAN_015", "작성한 여행 후기가 없습니다.", HttpStatus.NOT_FOUND),
    REVIEW_PLAN_NOT_COMPLETED("PLAN_016", "완료된 일정만 후기를 쓰거나 볼 수 있습니다.", HttpStatus.BAD_REQUEST),
    REVIEW_ALREADY_EXISTS("PLAN_017", "이미 이 일정의 후기를 작성했습니다.", HttpStatus.CONFLICT),
    REVIEW_ITEM_NOT_ELIGIBLE("PLAN_018", "다녀온 장소 항목만 후기에 담을 수 있습니다.", HttpStatus.BAD_REQUEST),
    REVIEW_ITEM_DUPLICATED("PLAN_020", "같은 일정 항목을 후기에 두 번 넣을 수 없습니다.", HttpStatus.BAD_REQUEST),
    PLAN_COPY_PERIOD_MISMATCH("PLAN_021", "복사할 여행 기간의 일수는 원본과 같아야 합니다.", HttpStatus.BAD_REQUEST),
    INVALID_REQUEST("PLAN_100", "요청 값이 올바르지 않습니다.", HttpStatus.BAD_REQUEST),
    // 프레임워크 공통 2종은 검증 대역 끝에 둔다 (coding-conventions §8-2). PLAN_115 가 petIds 필드 코드로
    // 쓰이면서 한 칸씩 밀렸고, 준비물 필드 코드가 PLAN_116~123 을 가져가면서 다시 밀었다.
    // FE 가 참조하는 것은 PLAN_101~107·PLAN_114 뿐이라 이 이동에 걸리는 곳은 없다.
    PARAMETER_TYPE_INVALID("PLAN_124", "요청 파라미터 형식이 올바르지 않습니다.", HttpStatus.BAD_REQUEST),
    PARAMETER_REQUIRED("PLAN_125", "필수 요청 파라미터가 누락되었습니다.", HttpStatus.BAD_REQUEST),
    INTERNAL_SERVICE_UNAVAILABLE("PLAN_900", "내부 서비스 연동에 실패했습니다. 잠시 후 다시 시도해주세요.", HttpStatus.SERVICE_UNAVAILABLE);

    private final String code;
    private final String message;
    private final HttpStatus httpStatus;
}
