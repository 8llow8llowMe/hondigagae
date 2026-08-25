package com.hondigagae.security.common.handler;

import com.hondigagae.security.common.exception.SecurityErrorCode;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;

public interface SecurityErrorResponseWriter {
    
    void write(HttpServletResponse response, SecurityErrorCode errorCode, String detail) throws IOException;
}
