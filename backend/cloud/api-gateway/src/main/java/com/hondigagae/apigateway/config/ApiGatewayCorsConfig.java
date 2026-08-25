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
        config.setAllowedOriginPatterns(List.of(
            "http://localhost:5173",
            "http://localhost:3000",
            "http://hondigagae-dev.store:[*]",
            "http://*.hondigagae-dev.store:[*]",
            "https://hondigagae.com",
            "https://www.hondigagae.com",
            // 개발 웹(dev.hondigagae.com)의 두 경로가 이 필터를 지난다.
            // 1) BFF 가 브라우저 헤더를 보존해 전달하는 프록시 요청 — 브라우저는 같은 출처라도
            //    POST 에 Origin 을 붙이므로, 목록에 없으면 쓰기 요청만 전부 빈 403 이 된다.
            //    (CorsWebFilter 거부는 상태만 설정하고 본문을 쓰지 않는다. GET 은 Origin 이
            //    없어 통과하니 "조회는 되는데 등록만 안 되는" 형태로 나타난다)
            // 2) 브라우저가 게이트웨이로 직접 붙는 WebSocket(wss://api-dev...) 핸드셰이크.
            "https://dev.hondigagae.com",
            // 집계 Swagger UI가 서빙되는 API 도메인 origin (auth-service 설정과 일관성 유지)
            "https://api.hondigagae.com",
            "https://api-dev.hondigagae.com"
        ));

        config.setAllowedHeaders(List.of("*"));
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);

        return new CorsWebFilter(source);
    }
}
