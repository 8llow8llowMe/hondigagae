package com.hondigagae.global.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 인증 메일 발신자 표시와 템플릿 브랜딩 설정 (#1062).
 *
 * <p>세 값 모두 선택이다. 비워 두면 발신자 이름은 "혼디가개", 발신 주소는 SMTP 계정
 * ({@code spring.mail.username})에서 유도하고, 로고는 jar 에 든 로크업 PNG 를 메일에 인라인(CID)으로 붙인다.
 *
 * @param fromName    발신자 표시 이름. 비면 "혼디가개"
 * @param fromAddress 발신 주소. 비면 SMTP 계정에서 유도한다
 * @param logoUrl     메일 머리 로고(PNG) 절대 URL. 비면 {@code classpath:mail/logo-lockup.png} 를 인라인으로 첨부한다
 */
@ConfigurationProperties(prefix = "auth.mail")
public record AuthMailProperties(
    String fromName,
    String fromAddress,
    String logoUrl
) {

    public static final String DEFAULT_FROM_NAME = "혼디가개";

    public AuthMailProperties {
        fromName = isBlank(fromName) ? DEFAULT_FROM_NAME : fromName.trim();
        fromAddress = isBlank(fromAddress) ? "" : fromAddress.trim();
        logoUrl = isBlank(logoUrl) ? "" : logoUrl.trim();
    }

    /** 외부 URL 로고를 쓰는가. false 면 어댑터가 로크업 PNG 를 CID 인라인으로 첨부한다. */
    public boolean usesLogoUrl() {
        return !logoUrl.isEmpty();
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
