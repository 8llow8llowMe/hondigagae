package com.hondigagae.domainlayer.plan.application.exception;

import lombok.Getter;

@Getter
public class PlanException extends RuntimeException {

    private final PlanErrorCode errorCode;

    public PlanException(PlanErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public PlanException(PlanErrorCode errorCode, Throwable cause) {
        super(errorCode.getMessage(), cause);
        this.errorCode = errorCode;
    }

    /**
     * 메시지에 값을 끼운다. 거절만 알리고 <b>무엇으로 맞춰야 하는지</b>를 말하지 않으면
     * 사용자는 시행착오를 하게 된다 — 프론트는 서버 {@code resultMessage} 를 그대로
     * 띄우므로 문구에 없는 정보는 화면에도 없다.
     *
     * <p>새 규약이 아니다. auth-service 의 {@code MemberException} 이 같은 모양의
     * 오버로드를 이미 갖고 있고 {@code MEMBER_001} 이 이메일을 끼워 쓴다. 여기서 형식을
     * 다르게 두면 서비스마다 오류 문구를 만드는 방법이 갈린다.
     *
     * <p>{@code PlanExceptionHandler} 는 {@code exception.getMessage()} 를 응답에 실으므로
     * (열거값의 템플릿이 아니라) 포맷된 문구가 그대로 나간다.
     */
    public PlanException(PlanErrorCode errorCode, Object... args) {
        super(String.format(errorCode.getMessage(), args));
        this.errorCode = errorCode;
    }
}
