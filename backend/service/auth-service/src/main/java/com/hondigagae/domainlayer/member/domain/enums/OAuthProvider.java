package com.hondigagae.domainlayer.member.domain.enums;

import java.util.Arrays;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 소셜 로그인 제공자. 회원의 속성이므로 member 도메인에 둔다.
 * (auth 컨텍스트가 이 enum을 참조하는 방향은 기존 auth -> member 의존과 일치한다)
 */
@Getter
@RequiredArgsConstructor
public enum OAuthProvider {

    KAKAO("카카오"),
    NAVER("네이버");

    private final String description;

    public static OAuthProvider fromName(String providerName) {
        return Arrays.stream(values())
            .filter(provider -> provider.name().equalsIgnoreCase(providerName))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("지원하지 않는 OAuth 제공자입니다: " + providerName));
    }
}
