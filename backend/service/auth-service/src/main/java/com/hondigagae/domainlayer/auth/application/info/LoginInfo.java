package com.hondigagae.domainlayer.auth.application.info;

import com.hondigagae.security.common.enums.SecurityRole;
import lombok.Builder;

@Builder
public record LoginInfo(
    long memberId,
    SecurityRole role
) {

    public static LoginInfo of(long memberId, SecurityRole role) {
        return LoginInfo.builder()
            .memberId(memberId)
            .role(role)
            .build();
    }
}
