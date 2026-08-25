package com.hondigagae.security.common.resolver;

import com.hondigagae.security.common.exception.SecurityErrorCode;

public interface JwtTokenErrorResolver {

    SecurityErrorCode resolve(Throwable ex);
}

