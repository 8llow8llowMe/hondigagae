package com.hondigagae.domainlayer.auth.application.info;

import lombok.Builder;

@Builder
public record JwtTokenReissueInfo(
    String accessToken,
    String newRefreshToken
) {

    public static JwtTokenReissueInfo of(String accessToken, String newRefreshToken) {
        return JwtTokenReissueInfo.builder()
            .accessToken(accessToken)
            .newRefreshToken(newRefreshToken)
            .build();
    }
}
