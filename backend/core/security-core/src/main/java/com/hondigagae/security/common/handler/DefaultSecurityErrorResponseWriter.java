package com.hondigagae.security.common.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.common.dto.Response;
import com.hondigagae.security.common.exception.SecurityErrorCode;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;

/**
 * 시큐리티 실패(401 · 403) 응답을 쓴다. <b>기본값이 곧 옳은 계약이다</b> (#502).
 *
 * <p>전에는 {@code {code, message}} 라는 자체 포맷을 썼다. security-core 를 쓰는 세 서비스가
 * 전부 {@code @Primary} 로 같은 내용의 설정을 복사해 덮고 있었으므로 실제 응답에는 나오지
 * 않았지만, <b>기본값이 틀린 쪽이라는 것이 문제였다</b> — 새 서비스가 그 복사를 잊으면 그
 * 서비스의 401/403 만 봉투 밖으로 나간다. 프론트의 {@code hasEnvelope()} 가 그것을 걸러
 * {@code resultCode} 를 통째로 버리므로, 사용자는 서버가 준 사유 대신 일반 오류를 본다.
 *
 * <p>그래서 덮을 필요가 없도록 기본을 고쳤다. 서비스별 오버라이드 3벌은 지웠다.
 *
 * <p><b>{@code detail} 은 응답에 싣지 않는다.</b> 토큰이 왜 거부됐는지의 내부 사정이라
 * 인증되지 않은 호출자에게 줄 정보가 아니다 — 종전 동작과 같다.
 */
@RequiredArgsConstructor
public class DefaultSecurityErrorResponseWriter implements SecurityErrorResponseWriter {

    private final ObjectMapper objectMapper;

    @Override
    public void write(HttpServletResponse response, SecurityErrorCode errorCode, String detail) throws IOException {
        response.setStatus(errorCode.getHttpStatus().value());
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");

        Response<Void> body = Response.fail(errorCode.getCode(), errorCode.getMessage());
        response.getWriter().write(objectMapper.writeValueAsString(body));
    }
}
