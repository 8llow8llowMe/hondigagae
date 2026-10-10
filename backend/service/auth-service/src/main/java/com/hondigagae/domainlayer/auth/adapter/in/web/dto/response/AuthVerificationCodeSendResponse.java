package com.hondigagae.domainlayer.auth.adapter.in.web.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

@Builder
@Schema(description = "인증코드 발송 응답 DTO. 가입 여부와 무관하게 항상 같은 값이다 (계정 열거 방지)")
public record AuthVerificationCodeSendResponse(

    @Schema(description = "인증코드 유효 시간(초). 발송 시점부터 이 시간이 지나면 코드가 만료된다. "
        + "기가입 · 미가입 이메일처럼 실제로 코드가 발급되지 않은 경우에도 같은 값이다", example = "300")
    long codeExpiresInSeconds,

    @Schema(description = "같은 이메일로 다시 발송을 요청할 수 있을 때까지 남은 시간(초). "
        + "이보다 먼저 요청하면 429(AUTH_003)와 Retry-After 헤더가 돌아온다", example = "60")
    long resendAvailableInSeconds
) {

}
