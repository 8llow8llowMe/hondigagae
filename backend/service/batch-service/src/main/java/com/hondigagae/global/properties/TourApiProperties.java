package com.hondigagae.global.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * TourAPI(한국관광공사 B551011 계열) 공통 접속 설정.
 *
 * <p>serviceKey는 공공데이터포털의 "디코딩(원문)" 키를 그대로 넣는다.
 * URL 인코딩은 클라이언트가 수행하므로 인코딩된 키를 넣으면 이중 인코딩으로 인증에 실패한다.
 */
@ConfigurationProperties(prefix = "tour-api")
public record TourApiProperties(
    String baseUrl,
    String serviceKey,
    String mobileOs,
    String mobileApp
) {

    public TourApiProperties {
        if (baseUrl == null || baseUrl.isBlank()) {
            baseUrl = "https://apis.data.go.kr/B551011";
        }
        if (mobileOs == null || mobileOs.isBlank()) {
            mobileOs = "ETC";
        }
        if (mobileApp == null || mobileApp.isBlank()) {
            mobileApp = "hondigagae";
        }
    }
}
