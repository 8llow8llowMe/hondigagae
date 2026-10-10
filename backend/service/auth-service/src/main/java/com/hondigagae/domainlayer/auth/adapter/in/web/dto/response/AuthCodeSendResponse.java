package com.hondigagae.domainlayer.auth.adapter.in.web.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

@Builder
@Schema(description = "인증코드 발송 응답 DTO. 회원가입 인증 · 비밀번호 재설정 발송이 같은 모양이며, "
    + "가입 여부(기가입 · 미가입 · 탈퇴 · 소셜 전용)와 무관하게 항상 같은 값이다")
public record AuthCodeSendResponse(

    @Schema(description = "발송한 인증코드의 유효 시간(초). 이 시간이 지나면 코드가 만료돼 검증이 AUTH_005 로 실패합니다. "
        + "가입 여부와 무관한 고정값이라 실제로 코드가 발송됐는지를 뜻하지 않습니다", example = "300")
    long codeExpiresInSeconds,

    @Schema(description = "같은 이메일로 다시 발송할 수 있을 때까지 남은 시간(초). 그 전에 다시 요청하면 429 AUTH_003 입니다",
        example = "60")
    long resendAvailableInSeconds
) {

}
