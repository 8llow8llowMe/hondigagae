package com.hondigagae.global.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 다중 기기 로그인 세션 설정.
 *
 * <p>refresh 토큰은 기기(로그인)별로 저장하며, maxDevices 를 넘으면 가장 오래 갱신되지 않은
 * 세션부터 밀어낸다 (해당 기기는 access 만료 시점에 재로그인 필요).
 */
@ConfigurationProperties(prefix = "auth.session")
public record AuthSessionProperties(int maxDevices) {

    private static final int DEFAULT_MAX_DEVICES = 5;

    public AuthSessionProperties {
        if (maxDevices <= 0) {
            maxDevices = DEFAULT_MAX_DEVICES;
        }
    }
}
