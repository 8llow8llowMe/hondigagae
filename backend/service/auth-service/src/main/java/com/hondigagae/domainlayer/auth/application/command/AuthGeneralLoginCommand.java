package com.hondigagae.domainlayer.auth.application.command;

import com.hondigagae.domainlayer.auth.adapter.in.web.dto.request.AuthGeneralLoginRequest;
import lombok.Builder;

@Builder
public record AuthGeneralLoginCommand(
    String email,
    String password
) {

    public static AuthGeneralLoginCommand from(AuthGeneralLoginRequest request) {
        return AuthGeneralLoginCommand.builder()
            .email(request.email())
            .password(request.password())
            .build();
    }
}
