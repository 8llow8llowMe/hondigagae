package com.hondigagae.apigateway.config;

import com.hondigagae.apigateway.filter.JwtAuthApiGatewayFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@RequiredArgsConstructor
public class ApiGatewayRoutesConfig {

    // 생성자 DI를 사용하는 이유
    // 1. 이 설정 클래스는 "Gateway 필터들 조립(Composition)"을 담당하는 Config 역할이다.
    // - @Bean 메서드 파라미터 DI는 "Bean을 생성하기 위해 필요한 직접 의존성"에 적합하지만,
    // - 여러 필터를 조합하는 구성(Config)에서는 생성자 DI가 더 직관적이다.

    // 2. 필드/생성자 DI를 사용하면 Config 클래스 단위에서 필요한 의존성이 명확히 드러나고,
    // - 주입 대상 필터가 여러 개로 확장되어도 @Bean 시그니처가 난잡해지지 않는다.

    // 3. 테스트 코드에서도 Config 객체를 쉽게 Mocking/주입해 조립할 수 있어 유지보수가 용이하다.
    private final JwtAuthApiGatewayFilter jwtAuthApiGatewayFilter;

    @Bean
    public GlobalFilter jwtAuthGlobalFilter() {
        return (exchange, chain) ->
            jwtAuthApiGatewayFilter.apply(new JwtAuthApiGatewayFilter.Config())
                .filter(exchange, chain);
    }
}
