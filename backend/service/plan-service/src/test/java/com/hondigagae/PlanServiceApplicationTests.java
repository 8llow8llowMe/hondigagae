package com.hondigagae;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * 컨텍스트 로딩 게이트.
 *
 * <p>plan-service 의 테스트는 전부 단위 테스트라 스프링 컨텍스트를 띄우지 않는다. 그래서 같은 이름의
 * {@code @Component} 가 두 패키지에 생겨 기본 빈 이름이 충돌하는 종류의 결함은 CI 를 통과하고
 * dev 배포에서야 {@code ConflictingBeanDefinitionException} 으로 드러났다(2026-09-03,
 * favorite / plan 의 {@code InternalResponseSupport}). 이 테스트는 그 구멍을 막는다 —
 * 빈 정의·프로퍼티 바인딩·JPA 매핑이 test 프로파일(H2, Eureka 비활성)에서 한 번 끝까지 조립되는지 본다.
 */
@SpringBootTest
@ActiveProfiles("test")
class PlanServiceApplicationTests {

    @Test
    void contextLoads() {
    }
}
