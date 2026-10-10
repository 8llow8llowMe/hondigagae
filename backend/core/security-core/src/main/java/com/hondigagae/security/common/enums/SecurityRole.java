package com.hondigagae.security.common.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum SecurityRole {
    USER("일반 회원"),
    MANAGER("매니저"),
    ADMIN("관리자");

    private final String displayName;

    public static SecurityRole from(String name) {
        return SecurityRole.valueOf(name.toUpperCase());
    }
}
