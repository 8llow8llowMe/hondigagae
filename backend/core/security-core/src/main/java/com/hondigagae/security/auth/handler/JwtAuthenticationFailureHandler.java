package com.hondigagae.security.auth.handler;

import com.hondigagae.security.common.exception.SecurityErrorCode;
import com.hondigagae.security.common.exception.SecurityJwtException;
import com.hondigagae.security.common.handler.AuthenticationFailureHandler;
import com.hondigagae.security.common.handler.SecurityErrorResponseWriter;
import com.hondigagae.security.common.handler.SecurityExceptionHandler;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;

public class JwtAuthenticationFailureHandler extends SecurityExceptionHandler implements AuthenticationFailureHandler {

    public JwtAuthenticationFailureHandler(SecurityErrorResponseWriter errorResponseWriter) {
        super(errorResponseWriter);
    }

    @Override
    public boolean handleAuthenticationFailure(
        HttpServletRequest request, HttpServletResponse response, Throwable exception) throws IOException {

        if (!supports(exception)) {
            return false;
        }

        SecurityJwtException jwtException = (SecurityJwtException) exception;
        SecurityErrorCode errorCode = jwtException.getErrorCode();

        sendErrorResponse(response, errorCode, errorCode.getMessage());

        return true;
    }

    @Override
    public boolean supports(Throwable exception) {
        return exception instanceof SecurityJwtException;
    }
}
