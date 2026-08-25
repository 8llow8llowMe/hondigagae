package com.hondigagae.security.common.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.security.common.exception.SecurityErrorCode;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;

@RequiredArgsConstructor
public class DefaultSecurityErrorResponseWriter implements SecurityErrorResponseWriter {

    private final ObjectMapper objectMapper;

    @Override
    public void write(HttpServletResponse response, SecurityErrorCode errorCode, String detail) throws IOException {
        response.setStatus(errorCode.getHttpStatus().value());
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("code", errorCode.getCode());
        body.put("message", errorCode.getMessage());

        response.getWriter().write(objectMapper.writeValueAsString(body));
    }
}
