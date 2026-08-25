package com.hondigagae.global.config;

import com.hondigagae.common.config.SwaggerSecurityConfigurer;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.servers.Server;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Profile;

@Configuration
@Profile("!prod")
@Import(SwaggerSecurityConfigurer.class)
public class TourServiceSwaggerConfig {

    @Bean
    public OpenAPI tourServiceOpenApi(Components components) {
        return new OpenAPI()
            .components(components)
            .info(new Info()
                .title("혼디가개 관광 데이터 서비스 API 명세서")
                .description("Tour Service 전용 — 장소 검색/상세, 산책 코스, 여행 적합도, 긴급 시설")
                .version("v1")
            )
            // 서버를 상대 경로("/")로 두어, 집계 Swagger UI가 문서를 불러온 공개 origin
            // 기준으로 호출하게 한다(내부 컨테이너 주소로 잡혀 CORS 나는 문제 방지).
            .servers(List.of(
                new Server().url("/").description("Tour Service")
            ));
    }
}
