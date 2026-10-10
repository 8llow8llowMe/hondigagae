package com.hondigagae.domainlayer.member.application.command;

import com.hondigagae.domainlayer.member.adapter.in.web.dto.request.MemberGeneralSignupRequest;
import lombok.Builder;

@Builder
public record MemberGeneralSignupCommand(
    String email,
    String password,
    String name,
    String nickname,
    boolean termsAgreed,
    boolean privacyAgreed,
    boolean ageOver14Confirmed
) {

    public static MemberGeneralSignupCommand from(MemberGeneralSignupRequest request) {
        return MemberGeneralSignupCommand.builder()
            .email(request.email())
            .password(request.password())
            .name(request.name())
            .nickname(request.nickname())
            .termsAgreed(request.termsAgreed())
            .privacyAgreed(request.privacyAgreed())
            .ageOver14Confirmed(request.ageOver14Confirmed())
            .build();
    }
}
