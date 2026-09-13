package com.hondigagae.domainlayer.planner.application.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum AiPlanErrorCode {

    DATE_RANGE_INVALID("AIPLAN_001", "여행 시작일은 종료일보다 늦을 수 없습니다.", HttpStatus.BAD_REQUEST),
    JOB_NOT_FOUND("AIPLAN_002", "요청하신 AI 일정 생성 작업을 찾을 수 없습니다.", HttpStatus.NOT_FOUND),
    JOB_STORE_UNAVAILABLE("AIPLAN_003", "AI 일정 작업 저장소를 사용할 수 없습니다.", HttpStatus.SERVICE_UNAVAILABLE),
    JOB_QUEUE_FULL("AIPLAN_004", "AI 일정 생성 요청이 많아 대기열이 가득 찼습니다. 잠시 후 다시 시도해 주세요.", HttpStatus.SERVICE_UNAVAILABLE),
    JOB_FAILED("AIPLAN_005", "AI 일정 생성 작업이 실패했습니다.", HttpStatus.INTERNAL_SERVER_ERROR),
    JOB_TIMEOUT("AIPLAN_006", "AI 일정 생성 작업이 시간 내에 완료되지 않았습니다.", HttpStatus.GATEWAY_TIMEOUT),
    LLM_UNAVAILABLE("AIPLAN_007", "AI 일정 생성 서비스를 일시적으로 사용할 수 없습니다.", HttpStatus.SERVICE_UNAVAILABLE),
    IDEMPOTENCY_KEY_GENERATION_FAILED("AIPLAN_008", "AI 일정 요청 식별자 생성에 실패했습니다.", HttpStatus.INTERNAL_SERVER_ERROR),
    INTERNAL_SERVICE_UNAVAILABLE("AIPLAN_009", "연결된 내부 서비스를 일시적으로 사용할 수 없습니다.", HttpStatus.SERVICE_UNAVAILABLE),
    LLM_RESPONSE_INVALID("AIPLAN_010", "AI 응답을 일정으로 해석하지 못했습니다.", HttpStatus.INTERNAL_SERVER_ERROR),
    LLM_REFUSED("AIPLAN_011", "요청 내용이 AI 안전 정책에 걸려 일정을 생성하지 못했습니다.", HttpStatus.UNPROCESSABLE_ENTITY),
    NO_PLACE_CANDIDATES("AIPLAN_012", "여행 일정에 넣을 반려견 동반 가능 장소를 찾지 못했습니다.", HttpStatus.UNPROCESSABLE_ENTITY),
    PINNED_PLACE_UNAVAILABLE("AIPLAN_013", "필수 포함으로 지정한 장소를 찾을 수 없습니다. 삭제되었거나 잘못된 장소입니다.", HttpStatus.UNPROCESSABLE_ENTITY),
    REGENERATE_REQUEST_INVALID("AIPLAN_014", "하루 재생성에는 일정 식별자와 재생성할 일차가 함께 필요합니다.", HttpStatus.BAD_REQUEST),
    REGENERATE_DAY_OUT_OF_RANGE("AIPLAN_015", "재생성할 일차가 여행 기간을 벗어났습니다.", HttpStatus.BAD_REQUEST),
    PLAN_OUTLINE_UNAVAILABLE("AIPLAN_016", "재생성할 일정을 찾을 수 없습니다. 삭제되었거나 잘못된 일정입니다.", HttpStatus.UNPROCESSABLE_ENTITY),
    START_DATE_IN_PAST("AIPLAN_017", "여행 시작일은 오늘 이후여야 합니다.", HttpStatus.BAD_REQUEST),
    TRIP_DAYS_EXCEEDED("AIPLAN_018", "AI 일정 생성은 최대 10일까지 지원합니다.", HttpStatus.BAD_REQUEST),
    // 이미 끝난 작업의 취소. 400 이 아니라 409 다 - 요청이 잘못된 것이 아니라 대상의 상태가 지나간 것이다.
    JOB_NOT_CANCELABLE("AIPLAN_019", "이미 끝난 작업은 취소할 수 없습니다.", HttpStatus.CONFLICT),
    // 모델 호출 자체가 제한 시간을 넘긴 경우. LLM_UNAVAILABLE(연결 불가·서킷 열림)과 가른다 -
    // 사용자가 할 일이 다르고("조건을 줄여 보세요" vs "잠시 후"), 운영이 볼 곳도 다르다.
    //
    // 이 문구는 #508 전까지 거짓이었다. 동시 제출 2건이면 서로를 기다리다 둘 다 여기로 떨어져,
    // 조건과 무관한 실패에 대고 조건을 탓했다. 이제 대기는 LlmCallGate 가 흡수하고 이 시계는
    // 차례가 온 뒤부터 도므로, 여기 오는 것은 정말로 "내 요청이 무겁다" 뿐이다.
    LLM_TIMEOUT("AIPLAN_020", "AI 일정 생성이 제한 시간을 넘겼습니다. 여행 기간이나 조건을 줄여 다시 시도해 주세요.",
        HttpStatus.GATEWAY_TIMEOUT),
    // 차례를 기다리다 못 받은 경우 - 혼잡이지 조건 문제가 아니다 (#508).
    // LLM_TIMEOUT(내 요청이 무겁다) · JOB_QUEUE_FULL(제출 자체를 거절) 과 셋이 서로 다른 사건이다.
    // 사용자가 할 일은 "조건을 줄인다" 가 아니라 "조건 그대로 잠시 뒤 다시 누른다" 다.
    LLM_BUSY("AIPLAN_021", "지금 AI 일정 생성 요청이 몰려 있습니다. 조건은 그대로 두고 잠시 후 다시 시도해 주세요.",
        HttpStatus.SERVICE_UNAVAILABLE),

    // 요청 검증(Bean Validation) 전용 코드 — 1xx 대역.
    INVALID_REQUEST("AIPLAN_100", "요청 값이 올바르지 않습니다.", HttpStatus.BAD_REQUEST),
    PARAMETER_TYPE_INVALID("AIPLAN_113", "요청 파라미터 형식이 올바르지 않습니다.", HttpStatus.BAD_REQUEST),
    PARAMETER_REQUIRED("AIPLAN_114", "필수 요청 파라미터가 누락되었습니다.", HttpStatus.BAD_REQUEST);

    private final String code;
    private final String message;
    private final HttpStatus httpStatus;
}
