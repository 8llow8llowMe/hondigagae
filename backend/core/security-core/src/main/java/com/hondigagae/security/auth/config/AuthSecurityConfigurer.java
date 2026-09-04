package com.hondigagae.security.auth.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.security.auth.blacklist.AccessTokenBlacklistVerifier;
import com.hondigagae.security.auth.handler.JwtAuthenticationEntryPoint;
import com.hondigagae.security.auth.handler.JwtAuthenticationFailureHandler;
import com.hondigagae.security.auth.jwt.JwtAuthFilter;
import com.hondigagae.security.auth.jwt.JwtAuthProperties;
import com.hondigagae.security.auth.jwt.JwtAuthProvider;
import com.hondigagae.security.common.handler.AuthenticationFailureHandler;
import com.hondigagae.security.common.handler.CustomAccessDeniedHandler;
import com.hondigagae.security.common.handler.DefaultSecurityErrorResponseWriter;
import com.hondigagae.security.common.handler.SecurityErrorResponseWriter;
import java.util.Arrays;
import java.util.List;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.configurers.HeadersConfigurer;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

@EnableMethodSecurity(securedEnabled = true)
public class AuthSecurityConfigurer {

    @Bean
    public SecurityFilterChain securityFilterChain(
        HttpSecurity http, JwtAuthFilter jwtAuthFilter, CustomAccessDeniedHandler customAccessDeniedHandler,
        JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint) throws Exception {

        http
            // 1. CORS(Cross-Origin Resource Sharing) 설정 적용
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))

            // 2. 불필요한 기본 기능 비활성화
            // 2-1. CSRF 설정 비활성화
            .csrf(AbstractHttpConfigurer::disable)
            // 2-2. HTTP Basic 인증 방식을 비활성화 (ID/PW 기반 인증 사용하지 않음)
            .httpBasic(AbstractHttpConfigurer::disable)
            // 2-3. Spring Security 기본 로그인/로그아웃 기능 비활성화
            .formLogin(AbstractHttpConfigurer::disable)
            .logout(AbstractHttpConfigurer::disable)
            // 2-4. X-Frame-Options 비활성화 (H2 Console 접근 등 필요시 사용)
            .headers(header -> header.frameOptions(HeadersConfigurer.FrameOptionsConfig::disable))
            // 3. 모든 HTTP 요청에 대해 접근을 허용
            // 인증이 필요한 요청은 JwtAuthFilter에서 직접 토큰 검증을 수행하며,
            // @PreAuthorize 등 메서드 수준의 인가 처리는 EnableMethodSecurity에 의해 적용
            .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
            // 4. JWT 인증 필터 등록
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
            // 5. 예외 처리
            .exceptionHandling(ex -> ex
                // 토큰이 있는데 틀린 경우는 JwtAuthFilter 가 파싱 단계에서 401 을 쓴다.
                // 토큰이 없는 경우는 @PreAuthorize 가 익명 주체를 거부한 뒤 이 진입점으로 온다 — 등록하지 않으면
                // Spring 기본 403 이 Response 봉투 없이 나간다 (#214).
                .authenticationEntryPoint(jwtAuthenticationEntryPoint)
                // 인증은 됐지만 권한이 없는 경우(@PreAuthorize 역할 검사) 403 을 JSON 으로 내려준다.
                .accessDeniedHandler(customAccessDeniedHandler)
            );

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = getCorsConfiguration(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public FilterRegistrationBean<CorsFilter> corsFilterRegistrationBean() {
        CorsConfiguration config = getCorsConfiguration(6000L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        FilterRegistrationBean<CorsFilter> filterBean = new FilterRegistrationBean<>(new CorsFilter(source));
        filterBean.setOrder(0);
        return filterBean;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public JwtAuthProvider jwtAuthProvider(JwtAuthProperties jwtAuthProperties) {
        return new JwtAuthProvider(jwtAuthProperties);
    }

    @Bean
    public JwtAuthFilter jwtAuthFilter(
        JwtAuthProvider jwtAuthProvider, AuthenticationFailureHandler jwtAuthenticationFailureHandler,
        ObjectProvider<AccessTokenBlacklistVerifier> blacklistVerifierProvider
    ) {
        return new JwtAuthFilter(jwtAuthProvider, jwtAuthenticationFailureHandler, blacklistVerifierProvider.getIfAvailable());
    }

    @Bean
    public CustomAccessDeniedHandler customAccessDeniedHandler(SecurityErrorResponseWriter errorResponseWriter) {
        return new CustomAccessDeniedHandler(errorResponseWriter);
    }

    @Bean
    public AuthenticationFailureHandler jwtAuthenticationFailureHandler(SecurityErrorResponseWriter errorResponseWriter) {
        return new JwtAuthenticationFailureHandler(errorResponseWriter);
    }

    @Bean
    public JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint(SecurityErrorResponseWriter errorResponseWriter) {
        return new JwtAuthenticationEntryPoint(errorResponseWriter);
    }

    @Bean
    @ConditionalOnMissingBean(SecurityErrorResponseWriter.class)
    public SecurityErrorResponseWriter defaultSecurityErrorResponseWriter(ObjectMapper objectMapper) {
        return new DefaultSecurityErrorResponseWriter(objectMapper);
    }

    private CorsConfiguration getCorsConfiguration(long maxAge) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowCredentials(true);
        // 목록을 게이트웨이(ApiGatewayCorsConfig)와 같게 맞춰 둔다.
        // 이 저장소의 게이트웨이는 /api/v1/auth/**, /api/v1/members/** 를 라우팅하지만,
        // nginx 가 auth 로 직결하는 구성도 가능하다. 두 경로 어느 쪽이든 같은 출처가 통과해야 한다.
        config.setAllowedOriginPatterns(List.of(
            "http://localhost:5174",           // FE 로컬(next dev). 5173 은 BossPickSeoul 이 쓰고 있어 겹치지 않게 5174
            "https://dev.hondigagae.com",      // 개발 웹. BFF 가 브라우저 Origin 보존 전달 (빼면 members 쓰기만 403)
            "https://www.hondigagae.com",      // 운영 웹. 이유는 개발 웹과 동일 — Swagger 용 아님
            "https://api-dev.hondigagae.com"   // 개발 Swagger Try it out. nginx TLS 종료로 스킴이 달라 교차 출처 판정
        ));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setMaxAge(maxAge);
        return config;
    }
}
