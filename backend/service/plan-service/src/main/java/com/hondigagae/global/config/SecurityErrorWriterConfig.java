package com.hondigagae.global.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.common.dto.Response;
import com.hondigagae.security.common.handler.SecurityErrorResponseWriter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

@Configuration
public class SecurityErrorWriterConfig {

    /**
     * 시큐리티 실패 응답을 일반 API 응답과 같은 Response 래퍼로 통일한다.
     * (security-core 기본 writer는 {code, message} 자체 포맷을 쓰므로 오버라이드)
     */
    @Bean
    @Primary
    public SecurityErrorResponseWriter responseBackedSecurityErrorWriter(ObjectMapper objectMapper) {
        return (response, errorCode, detail) -> {
            response.setStatus(errorCode.getHttpStatus().value());
            response.setContentType("application/json");
            response.setCharacterEncoding("UTF-8");
            Response<Void> body = Response.fail(errorCode.getCode(), errorCode.getMessage());
            response.getWriter().write(objectMapper.writeValueAsString(body));
        };
    }
}
