package com.hondigagae.domainlayer.auth.application.command;

import lombok.Builder;

@Builder
public record TokenReissueCommand(
    String refreshToken
) {

    public static TokenReissueCommand from(String refreshToken) {
        return TokenReissueCommand.builder()
            .refreshToken(refreshToken)
            .build();
    }
}
