package com.hondigagae.domainlayer.auth.application.command;

import lombok.Builder;

@Builder
public record KakaoLoginCommand(
    String authCode,
    String state
) {

    public static KakaoLoginCommand of(String authCode, String state) {
        return KakaoLoginCommand.builder()
            .authCode(authCode)
            .state(state)
            .build();
    }
}
