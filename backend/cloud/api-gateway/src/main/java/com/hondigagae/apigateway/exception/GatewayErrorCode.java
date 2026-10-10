package com.hondigagae.apigateway.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

/**
 * 게이트웨이가 <b>스스로</b> 요청을 끝낼 때 내는 사유 (#1244). 응답은 서비스와 같은 공통 봉투다
 * (api-design-guide §2-2).
 *
 * <p>토큰 거부({@code JwtErrorCode})와 enum 을 나눈 이유: 그쪽은 security-core 의 {@code SecurityErrorCode} 와
 * <b>같은 코드를 내야 하는</b> 사본이고 {@code JwtErrorCodeContractTest} 가 소스를 대조해 묶고 있다. 서비스에 대응이
 * 없는 게이트웨이 고유 사유를 거기 섞으면 "이 enum 은 security-core 의 사본" 이라는 성질이 깨진다.
 *
 * <p>짝이 되는 예외·핸들러가 없는 것은 의도다. 레이트 리밋 거부는 예외가 아니라 판정 결과라 필터가 응답을 직접
 * 쓴다({@code SharedPlanRateLimitGatewayFilterFactory}).
 */
@Getter
@RequiredArgsConstructor
public enum GatewayErrorCode {

    RATE_LIMITED("GATEWAY_001", "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.", HttpStatus.TOO_MANY_REQUESTS);

    private final String code;
    private final String message;
    private final HttpStatus httpStatus;
}
