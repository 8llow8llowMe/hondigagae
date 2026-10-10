package com.hondigagae.apigateway.config;

import java.util.Arrays;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsWebFilter;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;

@Configuration
public class ApiGatewayCorsConfig {

    @Bean
    public CorsWebFilter corsWebFilter() {
        CorsConfiguration config = new CorsConfiguration();
        // 실제로 브라우저 Origin 이 백엔드에 도달하는 출처만 남긴다.
        config.setAllowedOriginPatterns(List.of(
            "http://localhost:5174",           // FE 로컬(next dev). 5173 은 BossPickSeoul 이 쓰고 있어 겹치지 않게 5174
            "https://dev.hondigagae.com",      // 개발 웹. BFF 가 브라우저 Origin 보존 전달 (빼면 쓰기만 빈 403)
            "https://www.hondigagae.com",      // 운영 웹. 이유는 개발 웹과 동일 — Swagger 용 아님
            "https://api-dev.hondigagae.com"   // 개발 Swagger Try it out. nginx TLS 종료로 스킴이 달라 교차 출처 판정
        ));

        config.setAllowedHeaders(List.of("*"));
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);

        return new CorsWebFilter(source);
    }
}
