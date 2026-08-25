package com.hondigagae.security.common.dto;

import com.hondigagae.security.common.enums.SecurityRole;
import lombok.Builder;

@Builder
public record MemberLoginActive(
    // 인증된 회원 식별자
    long memberId,
    // 회원 권한
    SecurityRole role,
    // Access Token의 jti (블랙리스트 키)
    String tokenId
) {

}
