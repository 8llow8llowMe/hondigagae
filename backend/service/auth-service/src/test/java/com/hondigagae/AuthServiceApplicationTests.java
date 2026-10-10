package com.hondigagae;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.pet.adapter.out.client.feign.PlanCompanionClient;
import com.hondigagae.domainlayer.pet.application.port.out.PlanCompanionCommandPort;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;

/**
 * 컨텍스트 로딩 게이트 (#972).
 *
 * <p>auth-service 의 테스트는 전부 단위 테스트라 스프링 컨텍스트를 띄우지 않았다. #972 로 이 서비스에 처음
 * Feign 클라이언트({@code @EnableFeignClients})와 두 번째 서킷 인스턴스가 들어오면서, 빈 이름 충돌·프로퍼티
 * 바인딩 누락처럼 <b>단위 테스트가 못 잡고 배포에서야 드러나는</b> 결함의 자리가 생겼다
 * (plan-service 의 {@code ConflictingBeanDefinitionException}, 2026-09-03). test 프로파일(H2, Eureka 비활성)에서
 * 빈 정의가 한 번 끝까지 조립되는지 본다.
 */
@SpringBootTest
@ActiveProfiles("test")
class AuthServiceApplicationTests {

    @Autowired
    private ApplicationContext applicationContext;

    @Test
    void contextLoads() {
        // Feign 프록시와 포트 구현이 실제로 빈으로 올라왔는지까지 본다 — @EnableFeignClients 가 빠지면 여기서 깨진다.
        assertThat(applicationContext.getBeansOfType(PlanCompanionClient.class)).hasSize(1);
        assertThat(applicationContext.getBeansOfType(PlanCompanionCommandPort.class)).hasSize(1);
    }
}
